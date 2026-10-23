#!/usr/bin/env python3
"""Headphones-only Windows pilot: authenticated central stream -> verified offline cache.

Never starts on boot, controls amplifiers, relays, ESP32 or PA. Requires an
explicit command-line consent and per-device server playback authorization.
"""
import argparse
import json
import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from standby_plan import standby_selection
from sync_agent import sync
from esp32_local import send_heartbeat
from audio_telemetry import playback_report, async_playback_report
from audio_output_probe import inspect_outputs

STOP = threading.Event()
PLAYBACK_STATE = {'mode':'STOPPED','lastAuthorized':0.0,'offlineGrace':900,'streamLastSeen':0.0,'broadcastRunning':False}


def get_status(server, token):
    request=Request(server.rstrip('/')+'/api/radio-agent/agent/status',
                    headers={'Authorization':'Bearer '+token})
    with urlopen(request,timeout=4) as response:
        return json.load(response)


def permitted(status):
    return status.get('mode')=='PILOT' and status.get('playbackEnabled') is True


def get_probe(server, token):
    request=Request(server.rstrip('/')+'/api/radio-agent/agent/stream',
                    headers={'Authorization':'Bearer '+token})
    with urlopen(request,timeout=7) as response:
        if response.status!=200 or 'audio/' not in response.headers.get('Content-Type',''):
            return False
        return len(response.read(2048))>=1024


class Relay(ThreadingHTTPServer):
    daemon_threads=True
    def __init__(self, server, token):
        self.server_url=server.rstrip('/')
        self.token=token
        self.last_data=0.0
        self.failed=threading.Event()
        super().__init__(('127.0.0.1',0),RelayHandler)


class RelayHandler(BaseHTTPRequestHandler):
    def log_message(self,*_args):
        pass

    def do_GET(self):
        if self.path!='/listen':
            self.send_error(404)
            return
        request=Request(self.server.server_url+'/api/radio-agent/agent/stream',
                        headers={'Authorization':'Bearer '+self.server.token})
        try:
            with urlopen(request,timeout=5) as upstream:
                if upstream.status!=200 or 'audio/' not in upstream.headers.get('Content-Type',''):
                    raise RuntimeError('Unexpected upstream stream')
                self.send_response(200)
                self.send_header('Content-Type','audio/mpeg')
                self.send_header('Cache-Control','no-store')
                self.end_headers()
                while not STOP.is_set():
                    block=upstream.read(8192)
                    if not block:
                        break
                    self.wfile.write(block)
                    self.server.last_data=time.monotonic()
        except (OSError,HTTPError,URLError,RuntimeError) as error:
            print('RELAY_FAILED',type(error).__name__,flush=True)
        finally:
            self.server.failed.set()


def start_vlc(executable, log, *args):
    with open(log,'ab',buffering=0) as stderr:
        return subprocess.Popen([str(executable),'--intf','dummy','--no-video',
                                 '--no-one-instance','--play-and-exit',*args],
                                stdout=subprocess.DEVNULL,stderr=stderr)


def stop_vlc(proc):
    if proc is not None and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=3)


def read_snapshot(file):
    try:
        data=json.loads(file.read_text(encoding='utf-8'))
        if isinstance(data.get('slots'),list) and isinstance(data.get('autoDj'),dict):
            return data
    except (OSError,ValueError,AttributeError):
        pass
    return None


def run(args, token):
    base=Path(args.data_dir).resolve()
    base.mkdir(parents=True,exist_ok=True)
    cache=base/'cache'
    logfile=base/'windows-central-vlc.log'
    snapshotfile=base/'snapshot.json'
    # Never begin playback without confirmed authorization. Transient network
    # timeouts must not terminate the GUI; retry until reachable or user stops.
    attempt=0
    while not STOP.is_set():
        try:
            if not permitted(get_status(args.server,token)):
                raise PermissionError('Server does not permit playback')
            break
        except HTTPError as error:
            if error.code in (401,403):
                raise PermissionError('Device token rejected or playback forbidden') from None
            attempt+=1
            print('SERVER_CONNECT_RETRY',type(error).__name__,flush=True)
        except PermissionError:
            # PermissionError inherits OSError; never treat explicit server denial as transient.
            raise
        except (TimeoutError,OSError,URLError) as error:
            attempt+=1
            print('SERVER_CONNECT_RETRY',type(error).__name__,flush=True)
        STOP.wait(min(15,2*attempt))
    if STOP.is_set():
        return
    snapshot=read_snapshot(snapshotfile)
    last_authorized=time.monotonic()
    PLAYBACK_STATE.update(mode='STOPPED',lastAuthorized=last_authorized,offlineGrace=args.offline_grace,streamLastSeen=0.0,broadcastRunning=True)
    relay=Relay(args.server,token)
    threading.Thread(target=relay.serve_forever,daemon=True).start()
    primary=None
    fallback=None
    fallback_key=None
    fallback_deadline=0.0
    last_primary_data=0.0
    last_probe=0.0
    next_sync=0.0
    result_lock=threading.Lock()
    results=[]
    sync_running=threading.Event()
    probe_running=threading.Event()
    network_ok=False
    denied=False
    esp32_host=getattr(args,'esp32_host',os.environ.get('RADIO_ESP32_IP','')).strip()
    esp32_secret=getattr(args,'esp32_secret',os.environ.get('RADIO_ESP32_SECRET','')).strip()
    last_esp32=0.0
    last_esp32_error_log=0.0
    esp32_error_kind=None
    last_audio_report=0.0
    output_probe={'state':'UNKNOWN','name':None,'count':None}
    last_output_probe=0.0
    output_probe_busy=threading.Event()

    def probe_output():
        nonlocal output_probe
        try:
            output_probe=inspect_outputs()
        finally:
            output_probe_busy.clear()

    def refresh():
        try:
            fresh=sync(args.server,token,base)
            with result_lock:
                results.append(fresh)
        except (OSError,ValueError,KeyError,RuntimeError) as error:
            print('SYNC_FAILED',type(error).__name__,flush=True)
        finally:
            sync_running.clear()

    def probe():
        nonlocal network_ok,denied,last_authorized
        try:
            status=get_status(args.server,token)
            if not permitted(status):
                denied=True
                return
            last_authorized=time.monotonic()
            PLAYBACK_STATE['lastAuthorized']=last_authorized
            network_ok=get_probe(args.server,token)
        except HTTPError as error:
            if error.code in (401,403):
                denied=True
            network_ok=False
        except (OSError,ValueError,RuntimeError):
            network_ok=False
        finally:
            probe_running.clear()

    print('WINDOWS HEADPHONES PILOT; NO AMP/ESP32. Stop with Ctrl+C.',flush=True)
    try:
        while not STOP.is_set():
            now=time.monotonic()
            # Playback health is independent from a power-intent HTTP request.
            active_audio=(primary is not None and primary.poll() is None and
                          not relay.failed.is_set() and now-relay.last_data<=4)
            reserve_audio=fallback is not None and fallback.poll() is None
            PLAYBACK_STATE['mode']='CENTRAL' if active_audio else 'LOCAL_RESERVE' if reserve_audio else 'STOPPED'
            if active_audio or reserve_audio:
                PLAYBACK_STATE['streamLastSeen']=now
            if now-last_output_probe>=30 and not output_probe_busy.is_set():
                last_output_probe=now
                output_probe_busy.set()
                threading.Thread(target=probe_output,daemon=True).start()
            if now-last_audio_report>=8:
                last_audio_report=now
                report=playback_report(primary,fallback,relay,now)
                report['outputEndpoint']=dict(output_probe)
                threading.Thread(target=async_playback_report,
                                 args=(args.server,token,report),daemon=True).start()
            if esp32_host and esp32_secret and now-last_esp32>=3:
                last_esp32=now
                # Safe pilot telemetry only. No relay actuation is possible.
                active=primary is not None and primary.poll() is None
                reserve=fallback is not None and fallback.poll() is None
                mode='CENTRAL' if active else 'LOCAL_RESERVE' if reserve else 'STOPPED'
                PLAYBACK_STATE['mode']=mode
                try:
                    send_heartbeat(esp32_host,esp32_secret,mode,active or reserve,
                        not denied and now-last_authorized<=args.offline_grace)
                    if esp32_error_kind is not None:
                        print('ESP32_HEARTBEAT_RECOVERED',flush=True)
                    esp32_error_kind=None
                except Exception as error:
                    reason=getattr(error,'reason',None)
                    reason_name=type(reason).__name__ if reason is not None else type(error).__name__
                    kind=type(error).__name__+':'+reason_name
                    if kind!=esp32_error_kind or now-last_esp32_error_log>=60:
                        print('ESP32_HEARTBEAT_FAILED',kind,
                              'Проверьте IP ESP32, локальную сеть и доступность HTTP /health',flush=True)
                        last_esp32_error_log=now
                    esp32_error_kind=kind
            with result_lock:
                if results:
                    snapshot=results[-1]
                    results.clear()
            if denied or now-last_authorized>args.offline_grace:
                print('PLAYBACK_PERMISSION_EXPIRED',flush=True)
                break
            if now>=last_probe and not probe_running.is_set():
                probe_running.set()
                threading.Thread(target=probe,daemon=True).start()
                last_probe=now+5
            if network_ok and now>=next_sync and not sync_running.is_set():
                sync_running.set()
                threading.Thread(target=refresh,daemon=True).start()
                next_sync=now+60
            if primary is None and network_ok:
                # Stop local reserve before starting primary to avoid overlapping audio.
                stop_vlc(fallback)
                fallback=None
                fallback_key=None
                relay.failed.clear()
                relay.last_data=time.monotonic()
                url='http://127.0.0.1:%d/listen'%relay.server_address[1]
                primary=start_vlc(args.vlc,logfile,'--network-caching=300',url)
                last_primary_data=relay.last_data
                print('PRIMARY_CONNECTING',flush=True)
            if primary is not None:
                if primary.poll() is not None or relay.failed.is_set() or (time.monotonic()-relay.last_data>4):
                    stop_vlc(primary)
                    primary=None
                    network_ok=False
                    print('LOCAL_STANDBY',flush=True)
            if primary is None:
                selection=standby_selection(snapshot or {},cache,time.time())
                if selection:
                    track=selection['track']
                    key=(selection['source'],track['id'])
                    remaining=max(0,track['durationMs']/1000-selection['offsetSeconds'])
                    if fallback is None or fallback.poll() is not None or fallback_key!=key or now>=fallback_deadline:
                        stop_vlc(fallback)
                        fallback_key=key
                        fallback_deadline=now+remaining
                        fallback=start_vlc(args.vlc,logfile,
                                           '--start-time=%.3f'%selection['offsetSeconds'],
                                           selection['file'])
                        print('LOCAL_TRACK',selection['source'],track['id'],flush=True)
                else:
                    stop_vlc(fallback)
                    fallback=None
                    fallback_key=None
            STOP.wait(0.5)
    finally:
        PLAYBACK_STATE.update(mode='STOPPED',broadcastRunning=False,streamLastSeen=0.0)
        threading.Thread(target=async_playback_report,args=(args.server,token,
            {'playback':'STOPPED','outputDevice':'VLC (устройство вывода не подтверждено)',
             'lastPacketAgeMs':None,'error':''}),daemon=True).start()
        stop_vlc(primary)
        stop_vlc(fallback)
        relay.shutdown()
        relay.server_close()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--server',default='https://mediarafraw.ru')
    parser.add_argument('--data-dir',default='radio-agent-data')
    parser.add_argument('--vlc',required=True,help='Full path to vlc.exe')
    parser.add_argument('--enable-headphones-test',action='store_true')
    parser.add_argument('--offline-grace',type=int,default=900,
                        help='Maximum seconds without renewed server authorization, default 15 min')
    args=parser.parse_args()
    if not args.server.startswith('https://') or not args.enable_headphones_test:
        parser.error('HTTPS and explicit --enable-headphones-test consent required')
    if not 30<=args.offline_grace<=3600:
        parser.error('offline-grace must be 30..3600 seconds')
    executable=Path(args.vlc).resolve()
    if not executable.is_file() or executable.name.lower()!='vlc.exe':
        parser.error('Full path to vlc.exe required')
    token=os.environ.get('RADIO_AGENT_TOKEN','')
    if not token.startswith('rr_'):
        parser.error('RADIO_AGENT_TOKEN is required')
    try:
        run(args,token)
    except KeyboardInterrupt:
        STOP.set()


if __name__=='__main__':
    main()
