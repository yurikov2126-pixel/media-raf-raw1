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
from mchs_readiness import assess_mchs_readiness
from mchs_lab_chain_diagnostics import assess_lab_chain
from mchs_lab_chain_transition import LabChainTransition
from mchs_output_preflight import evaluate_isolated_output_preflight
from mchs_transition_shadow import MchsTransitionShadow
from mchs_isolated_output_pilot import LocalMonitor
from mchs_trial_watchdog import trial_stop_reason
from mchs_lab_trigger import next_lab_trigger
from mchs_lab_resume import should_stop_auto_lab
from mchs_lab_observer_failsafe import observer_failsafe

STOP = threading.Event()
MCHS_AUDIO_START = threading.Event()
MCHS_AUDIO_STOP = threading.Event()
MCHS_AUDIO_ARMED = threading.Event()
MCHS_LAB_ONE_SHOT = threading.Event()
MCHS_LAB_AUTO_ACTIVE = threading.Event()
MCHS_LAB_ONE_SHOT_EXPIRES = {'at': 0.0}
MCHS_LAB_ONE_SHOT_LOCK = threading.Lock()
MCHS_LAB_OBSERVED = {'phase':None,'revision':None,'at':0.0,'ready':False}
PLAYBACK_STATE = {'mode':'STOPPED','lastAuthorized':0.0,'offlineGrace':900,'streamLastSeen':0.0,'broadcastRunning':False}


def get_status(server, token):
    request=Request(server.rstrip('/')+'/api/radio-agent/agent/status',
                    headers={'Authorization':'Bearer '+token})
    with urlopen(request,timeout=4) as response:
        return json.load(response)


def permitted(status):
    return status.get('mode')=='PILOT' and status.get('playbackEnabled') is True



def send_mchs_observer_report(server, token, report):
    """Best-effort telemetry only; never blocks or controls playback."""
    payload=json.dumps(report).encode('utf-8')
    request=Request(server.rstrip('/')+'/api/radio-agent/agent/mchs-observer-report',
                    data=payload,headers={'Authorization':'Bearer '+token,
                    'Content-Type':'application/json'},method='POST')
    with urlopen(request,timeout=3) as response:
        return response.status==200


def read_mchs_observer(server, token):
    """Read-only lab state. This function must never touch VLC or power control."""
    request=Request(server.rstrip('/')+'/api/radio-agent/agent/mchs-integration-observe',
                    headers={'Authorization':'Bearer '+token})
    with urlopen(request,timeout=3) as response:
        return json.load(response)

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
        self.intentional_disconnect=threading.Event()
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
            if self.server.intentional_disconnect.is_set() or STOP.is_set():
                print('RELAY_CLOSED_FOR_HANDOVER',flush=True)
            else:
                print('RELAY_FAILED',type(error).__name__,flush=True)
        finally:
            if not self.server.intentional_disconnect.is_set():
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
    last_audio_report=0.0
    last_mchs_observer_poll=0.0
    mchs_observer_busy=threading.Event()
    last_mchs_observed_revision=None
    mchs_transition_shadow=MchsTransitionShadow()
    mchs_lab_chain_transition=LabChainTransition()
    trial_vlc=None
    trial_relay=None
    trial_started_at=0.0
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

    def check_mchs_observer():
        nonlocal last_mchs_observed_revision
        try:
            data=read_mchs_observer(args.server,token)
            revision=data.get('revision')
            if data.get('mode')!='OBSERVE_ONLY' or not isinstance(revision,int) or isinstance(revision,bool):
                print('MCHS_LAB_OBSERVER_INVALID',str(data.get('mode')),str(data.get('workerPhase')),type(revision).__name__,flush=True)
                return
            with MCHS_LAB_ONE_SHOT_LOCK:
                MCHS_LAB_OBSERVED.update(phase=data.get('workerPhase'),revision=revision,
                                         at=time.monotonic(),ready=True)
            moment=time.monotonic()
            primary_alive=primary is not None and primary.poll() is None
            reserve_alive=fallback is not None and fallback.poll() is None
            age_ms=(moment-relay.last_data)*1000 if relay.last_data else None
            ready=assess_mchs_readiness(
                primary_alive=primary_alive,reserve_alive=reserve_alive,
                last_packet_age_ms=age_ms,output_state=output_probe.get('state','UNKNOWN'),
                authorized=not denied and moment-last_authorized<=args.offline_grace,
                worker_phase=data.get('workerPhase'))
            preflight=evaluate_isolated_output_preflight(
                observer=ready,pa_cable_disconnected=False,
                separate_output_confirmed=False,operator_present=False)
            with MCHS_LAB_ONE_SHOT_LOCK:
                last_observed_at=MCHS_LAB_OBSERVED['at']
            with_state=trial_relay if trial_relay is not None else None
            if with_state is not None:
                with with_state.metrics_lock:
                    lab_connected=with_state.connected_at is not None
                    last_pcm_at=with_state.last_pcm_at
            else:
                lab_connected=False
                last_pcm_at=None
            chain=assess_lab_chain(
                observer_fresh=last_observed_at>0 and moment-last_observed_at<10,
                worker_phase=data.get('workerPhase'),
                authorized=not denied and moment-last_authorized<=args.offline_grace,
                primary_alive=primary_alive,reserve_alive=reserve_alive,
                output_state=output_probe.get('state','UNKNOWN'),
                lab_connected=lab_connected,
                pcm_age_seconds=moment-last_pcm_at if last_pcm_at is not None else None,
                trial_active=trial_vlc is not None)
            chain_event=mchs_lab_chain_transition.observe(chain)
            if chain_event is not None:
                print('MCHS_LAB_CHAIN_CHANGE',json.dumps(chain_event),flush=True)
            transition=mchs_transition_shadow.observe(revision,data.get('workerPhase'))
            report={'revision':revision,**ready,'preflight':preflight,
                    'transition':transition}
            if transition is not None:
                if should_stop_auto_lab(transition,auto_active=MCHS_LAB_AUTO_ACTIVE.is_set()):
                    MCHS_LAB_AUTO_ACTIVE.clear()
                    MCHS_AUDIO_ARMED.clear()
                    MCHS_AUDIO_STOP.set()
                    print('MCHS_LAB_AUTO_STOP_ON_RESUME',revision,data.get('workerPhase'),flush=True)
                with MCHS_LAB_ONE_SHOT_LOCK:
                    should_trigger=next_lab_trigger(
                        transition,armed=MCHS_LAB_ONE_SHOT.is_set(),
                        expires_at=MCHS_LAB_ONE_SHOT_EXPIRES['at'],now=moment)
                    if should_trigger:
                        MCHS_LAB_ONE_SHOT.clear()  # exactly once, before dispatch
                if should_trigger and not MCHS_AUDIO_ARMED.is_set() and not MCHS_AUDIO_START.is_set() and not STOP.is_set():
                    MCHS_AUDIO_STOP.clear()
                    MCHS_AUDIO_ARMED.set()
                    MCHS_LAB_AUTO_ACTIVE.set()
                    MCHS_AUDIO_START.set()
                    print('MCHS_LAB_ONE_SHOT_TRIGGERED',revision,flush=True)
                last_mchs_observed_revision=revision
                print('MCHS_AGENT_OBSERVER',json.dumps({
                    **report,'stationPlaybackChanged':False,'paOutputChanged':False}),flush=True)
            # Heartbeats refresh dashboard freshness even if revision is unchanged.
            # No audio, power or ESP32 action is performed by the observer.
            try:
                send_mchs_observer_report(args.server,token,report)
            except (OSError,ValueError):
                print('MCHS_AGENT_OBSERVER_REPORT_UNAVAILABLE',flush=True)
        except HTTPError as error:
            if error.code != 403:
                print('MCHS_AGENT_OBSERVER_UNAVAILABLE',error.code,flush=True)
        except (OSError,ValueError,KeyError):
            print('MCHS_AGENT_OBSERVER_UNAVAILABLE',flush=True)
        finally:
            mchs_observer_busy.clear()

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
            if now-last_mchs_observer_poll>=3 and not mchs_observer_busy.is_set():
                last_mchs_observer_poll=now
                mchs_observer_busy.set()
                threading.Thread(target=check_mchs_observer,daemon=True).start()
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
                except Exception as error:
                    print('ESP32_HEARTBEAT_FAILED',type(error).__name__,flush=True)
            with result_lock:
                if results:
                    snapshot=results[-1]
                    results.clear()
            # Fail closed if laboratory observer stops reporting fresh state.
            with MCHS_LAB_ONE_SHOT_LOCK:
                failsafe=observer_failsafe(
                    now=now,last_seen_at=MCHS_LAB_OBSERVED['at'],
                    automatic_trial_active=MCHS_LAB_AUTO_ACTIVE.is_set(),
                    one_shot_armed=MCHS_LAB_ONE_SHOT.is_set(),
                    expires_at=MCHS_LAB_ONE_SHOT_EXPIRES['at'])
                if failsafe['cancel_arm']:
                    MCHS_LAB_ONE_SHOT.clear()
                    print('MCHS_LAB_ONE_SHOT_CANCELLED',
                          'OBSERVER_STALE' if failsafe['observer_stale'] else 'ARM_EXPIRED',
                          flush=True)
            if failsafe['stop_trial']:
                MCHS_LAB_AUTO_ACTIVE.clear()
                MCHS_AUDIO_ARMED.clear()
                MCHS_AUDIO_STOP.set()
                print('MCHS_LAB_AUTO_STOP_OBSERVER_STALE',flush=True)

            # Operator-only local trial on the SAME Windows output, with the PA
            # audio cable physically disconnected. No network action can arm this.
            trial_reason=None
            if trial_vlc is not None:
                with trial_relay.metrics_lock:
                    connected_at=trial_relay.connected_at
                    last_pcm_at=trial_relay.last_pcm_at
                trial_reason=trial_stop_reason(
                    now=now,started_at=trial_started_at,
                    connected_at=connected_at,last_pcm_at=last_pcm_at,
                    stop_requested=MCHS_AUDIO_STOP.is_set(),
                    armed=MCHS_AUDIO_ARMED.is_set(),
                    authorized=not denied and now-last_authorized<=args.offline_grace,
                    vlc_running=trial_vlc.poll() is None)
            if trial_reason is not None or MCHS_AUDIO_STOP.is_set():
                if trial_reason:
                    print('MCHS_AUDIO_TRIAL_STOP_REASON',trial_reason,flush=True)
                MCHS_AUDIO_STOP.clear()
                if trial_relay is not None:
                    trial_relay.closing.set()
                stop_vlc(trial_vlc)
                trial_vlc=None
                if trial_relay is not None:
                    trial_relay.shutdown()
                    trial_relay.server_close()
                    trial_relay=None
                MCHS_LAB_AUTO_ACTIVE.clear()
                MCHS_AUDIO_ARMED.clear()
                MCHS_AUDIO_START.clear()
                network_ok=False  # trigger fresh normal stream probe/reconnect
                last_probe=0.0
                print('MCHS_AUDIO_TRIAL_STOPPED_RETURN_TO_PROGRAM',flush=True)
            if MCHS_AUDIO_START.is_set():
                MCHS_AUDIO_START.clear()
                if trial_vlc is None and MCHS_AUDIO_ARMED.is_set() and not denied and network_ok and now-last_authorized<15:
                    try:
                        # Close both audible decks before opening the training audio.
                        relay.intentional_disconnect.set()
                        stop_vlc(primary)
                        stop_vlc(fallback)
                        primary=None
                        fallback=None
                        fallback_key=None
                        relay.failed.set()
                        trial_relay=LocalMonitor(args.server,token)
                        threading.Thread(target=trial_relay.serve_forever,daemon=True).start()
                        lab_url='http://127.0.0.1:%d/lab.wav'%trial_relay.server_address[1]
                        trial_vlc=start_vlc(args.vlc,logfile,'--network-caching=120',lab_url)
                        trial_started_at=now
                        print('MCHS_AUDIO_TRIAL_STARTED_MAX_30_SECONDS',flush=True)
                    except (OSError,ValueError):
                        MCHS_AUDIO_STOP.set()
                        print('MCHS_AUDIO_TRIAL_FAILED',flush=True)
                else:
                    MCHS_AUDIO_ARMED.clear()
                    print('MCHS_AUDIO_TRIAL_REJECTED',flush=True)
            if trial_vlc is not None:
                PLAYBACK_STATE['mode']='MCHS_LAB_TRIAL'
                STOP.wait(0.2)
                continue
            if denied:
                print('PLAYBACK_PERMISSION_DENIED',flush=True)
                break
            # Keep the operator-started agent alive during a multi-hour outage.
            # Expired authorization must stop *both* audible decks, not the
            # reconnect loop. Probe will reauthorize after the network returns.
            if now-last_authorized>args.offline_grace:
                if primary is not None or fallback is not None:
                    stop_vlc(primary)
                    stop_vlc(fallback)
                    primary=None
                    fallback=None
                    fallback_key=None
                    relay.failed.set()
                    print('PLAYBACK_PERMISSION_EXPIRED_WAITING_FOR_NETWORK',flush=True)
                network_ok=False
                PLAYBACK_STATE['mode']='STOPPED'
                if now>=last_probe and not probe_running.is_set():
                    probe_running.set()
                    threading.Thread(target=probe,daemon=True).start()
                    last_probe=now+5
                STOP.wait(0.5)
                continue
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
                relay.intentional_disconnect.clear()
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
        MCHS_LAB_ONE_SHOT.clear()
        MCHS_AUDIO_ARMED.clear()
        MCHS_AUDIO_START.clear()
        MCHS_AUDIO_STOP.clear()
        if trial_relay is not None:
            trial_relay.closing.set()
        stop_vlc(trial_vlc)
        if trial_relay is not None:
            trial_relay.shutdown()
            trial_relay.server_close()
        relay.intentional_disconnect.set()
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
