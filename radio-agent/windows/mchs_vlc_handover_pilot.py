"""Operator-controlled *local* VLC music -> WAV -> music rehearsal.

This does not touch central_playout, station Worker, Android, PA or ESP32.
Only starts and stops VLC children created by this script. Any other
running audio programs are left alone.
"""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile
import time

from mchs_headphones_trial import fetch_self_test, verify_self_test, wait_for_natural_completion
from mchs_alarm_playback import AlarmPlaybackSession
from mchs_local_handover import run_isolated_handover


class LocalVlcProgram:
    def __init__(self, vlc, music, *, launch=None, sleep=time.sleep):
        self.vlc=Path(vlc).resolve()
        self.music=Path(music).resolve()
        self.launch=launch or self._launch
        self.sleep=sleep
        self.process=None

    def _launch(self, audio):
        return subprocess.Popen(
            [str(self.vlc),'--intf','dummy','--no-video','--no-one-instance',
             '--play-and-exit',str(audio)],
            stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL)

    def start_program(self):
        if self.process is not None and self.process.poll() is None:
            return False
        self.process=self.launch(self.music)
        self.sleep(0.4)
        return self.process is not None and self.process.poll() is None

    def pause_program(self):
        if self.process is None:
            return False
        process=self.process
        try:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=3)
            return process.poll() is not None
        finally:
            self.process=None

    def restored(self):
        return self.process is not None and self.process.poll() is None

    def cleanup(self):
        if self.process is not None:
            self.pause_program()


def run_real_vlc_pilot(*, server,token,vlc,music,repeats=4,
                       ask=input,output=print,launch=None,
                       timeout_s=60,wait_completion=wait_for_natural_completion):
    exe=Path(vlc).resolve()
    track=Path(music).resolve()
    if not exe.is_file() or exe.name.lower()!='vlc.exe':
        raise ValueError('VLC_EXE_REQUIRED')
    if not track.is_file() or track.suffix.lower() not in ('.mp3','.wav','.flac','.ogg'):
        raise ValueError('LOCAL_PROGRAM_FILE_REQUIRED')
    if type(repeats) is not int or not 1<=repeats<=5:
        raise ValueError('INVALID_REPEATS')
    # This self-test is a two-second identification WAV, not a real siren.
    data=fetch_self_test(server,token)
    with tempfile.TemporaryDirectory(prefix='mediaraf-local-handover-') as td:
        audio=Path(td)/'training.wav'
        audio.write_bytes(data)
        verify_self_test(audio)
        answer=ask('AA-300/PA disconnected, headphones connected? Type ISOLATED: ')
        if answer.strip()!='ISOLATED':
            raise PermissionError('PHYSICAL_OUTPUT_ISOLATION_REQUIRED')
        program=LocalVlcProgram(exe,track,launch=launch)
        if not program.start_program():
            program.cleanup()
            raise RuntimeError('LOCAL_PROGRAM_NOT_PLAYING')
        output('LOCAL_PROGRAM_STARTED')
        try:
            def training(n):
                session=AlarmPlaybackSession(
                    lambda file: program.launch(file),isolation_verified=True)
                accepted=session.start(
                    event_id='local-vlc-handover-training',file=audio,
                    repeats=n,authorized=True)
                if not accepted['accepted']:
                    raise RuntimeError('LOCAL_TRAINING_START_DENIED')
                try:
                    return wait_completion(session,timeout_s=timeout_s)
                except BaseException:
                    stopped=session.stop()
                    if not stopped.get('stopConfirmed'):
                        raise RuntimeError('LOCAL_TRAINING_STOP_UNCONFIRMED')
                    raise

            result=run_isolated_handover(
                is_isolated=True,
                pause_program=program.pause_program,
                play_training=training,
                resume_program=program.start_program,
                confirm_restored=program.restored,
                repeats=repeats)
            output('LOCAL_HANDOVER_RESULT',result)
            return result
        finally:
            # This pilot owns only its own process, never the actual Radio Agent.
            program.cleanup()


def main():
    p=argparse.ArgumentParser(description='Local VLC music-WAV-music headphones pilot')
    p.add_argument('--server',default='https://mediarafraw.ru')
    p.add_argument('--vlc',required=True)
    p.add_argument('--program-file',required=True,help='Local music MP3/WAV/FLAC/OGG')
    p.add_argument('--repeats',type=int,default=4)
    p.add_argument('--completion-timeout',type=float,default=60)
    args=p.parse_args()
    result=run_real_vlc_pilot(
        server=args.server,token=os.environ.get('RADIO_AGENT_TOKEN',''),
        vlc=args.vlc,music=args.program_file,repeats=args.repeats,
        timeout_s=args.completion_timeout)
    if not result.ok:
        raise SystemExit('LOCAL_HANDOVER_FAILED_'+result.reason)

if __name__=='__main__':
    main()
