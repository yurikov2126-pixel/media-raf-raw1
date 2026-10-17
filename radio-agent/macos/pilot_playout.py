#!/usr/bin/env python3
"""Opt-in pilot playout on macOS local audio output only. NO relay/ESP32 controls."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

from sync_agent import sync, fetch

def utc(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()

def hash_ok(file, expected):
    if not file.is_file(): return False
    with file.open('rb') as f:
        h=hashlib.sha256()
        while data:=f.read(1024*1024): h.update(data)
    return h.hexdigest()==expected

def main():
    p=argparse.ArgumentParser(description='Opt-in local speaker pilot; never controls amplifier')
    p.add_argument('--server', default='https://mediarafraw.ru')
    p.add_argument('--data-dir', default='radio-agent-data')
    p.add_argument('--vlc', required=True, help='Full path to VLC binary within VLC.app')
    p.add_argument('--enable-local-speaker', action='store_true', help='Required explicit local opt-in')
    args=p.parse_args()
    if not args.server.startswith('https://') or not args.enable_local_speaker:
        p.error('HTTPS and --enable-local-speaker required')
    token=os.environ.get('RADIO_AGENT_TOKEN','').strip()
    if not token: p.error('RADIO_AGENT_TOKEN must be set')
    executable=Path(args.vlc).resolve()
    if not executable.is_file() or executable.name != 'VLC':
        p.error('Provide /Applications/VLC.app/Contents/MacOS/VLC')
    base=Path(args.data_dir).resolve()
    base.mkdir(parents=True, exist_ok=True)
    pause_file=base/'live-priority.pause'
    history=base/'played.json'
    played=set(json.loads(history.read_text(encoding='utf-8'))) if history.exists() else set()
    print('PILOT MODE. Local macOS audio ONLY. NO ESP32 OR AMPLIFIER CONTROL.',flush=True)
    while True:
        try:
            if pause_file.exists():
                time.sleep(1)
                continue
            with fetch(args.server,token,'/api/radio-agent/agent/status') as resp:
                status=json.load(resp)
            drift=abs(utc(status['serverTime'])-time.time())
            if drift>30: raise RuntimeError('Mac clock differs from server by over 30 seconds')
            if status.get('mode')!='PILOT' or status.get('playbackEnabled') is not True:
                print('Playback not permitted by server; monitoring only',flush=True)
                time.sleep(15);continue
            snapshot=sync(args.server,token,base)
            now=time.time()
            for slot in snapshot['slots']:
                key=slot['id']
                scheduled=utc(slot['startAt'])
                # Never restart a show late, and never replay after process restart.
                if key in played or not (scheduled<=now<scheduled+10): continue
                print('Scheduled slot starting:',slot.get('playlistName'),key,flush=True)
                played.add(key)
                tmp=history.with_suffix('.part')
                tmp.write_text(json.dumps(sorted(played)),encoding='utf-8')
                os.replace(tmp,history)
                for track in slot['tracks']:
                    if pause_file.exists():
                        print('Live voice has priority; playlist suspended',flush=True)
                        break
                    # Recheck admin permission before every track.
                    with fetch(args.server,token,'/api/radio-agent/agent/status') as response:
                        allowed=json.load(response)
                    if allowed.get('playbackEnabled') is not True: break
                    audio=base/'cache'/(track['id']+'.audio')
                    if not hash_ok(audio,track['sha256']):
                        print('Skipping missing or corrupted audio',track['id'],file=sys.stderr);break
                    # VLC runs as child in interactive macOS session and sends audio to
                    # the selected macOS default output. Exit code is not assumed to
                    # guarantee audible playback.
                    duration=min(max(int(track['durationMs']/1000)+5,5),43205)
                    try:
                        print('Playing:',track.get('name'),str(audio),flush=True)
                        child=subprocess.Popen([str(executable),'--intf','dummy','--play-and-exit','--no-video',
                                        str(audio)],start_new_session=True)
                        deadline=time.monotonic()+duration
                        while child.poll() is None:
                            if pause_file.exists():
                                child.terminate()
                                try: child.wait(timeout=3)
                                except subprocess.TimeoutExpired: child.kill(); child.wait()
                                print('VLC stopped for live voice priority',flush=True)
                                break
                            if time.monotonic()>deadline:
                                child.kill(); child.wait()
                                print('Track playback timed out',track['id'],file=sys.stderr,flush=True)
                                break
                            time.sleep(0.2)
                    except subprocess.TimeoutExpired:
                        print('Track playback timed out',track['id'],file=sys.stderr);break
                break
        except (OSError,ValueError,KeyError,RuntimeError,subprocess.SubprocessError) as e:
            print('PILOT:',e,file=sys.stderr,flush=True)
        time.sleep(2)

if __name__=='__main__':
    try: main()
    except KeyboardInterrupt: print('Stopped')
