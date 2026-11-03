"""Operator-controlled local Windows audio sequence: music -> danger -> music
-> all-clear -> music. This is a *rehearsal*, never a real MCHS dispatch.

Creates and owns its own VLC processes; does not pause/control the running
Windows Radio Agent, the Worker public mixer, AA-300 or ESP32.
"""
import argparse
import hashlib
import os
from pathlib import Path
import tempfile
import time
import wave

from mchs_alarm_playback import AlarmPlaybackSession
from mchs_headphones_trial import wait_for_natural_completion
from mchs_local_handover import run_isolated_handover
from mchs_vlc_handover_pilot import LocalVlcProgram


MAX_WAV_SECONDS = 120
# PCM16 48 kHz stereo occupies 23,040,000 bytes over 120 seconds.
# Allow a bounded header/metadata margin without rejecting valid WAV.
MAX_WAV_BYTES = 32 * 1024 * 1024


def verify_local_training_wav(path):
    path=Path(path).resolve()
    if path.suffix.lower()!='.wav' or not path.is_file():
        raise ValueError('LOCAL_WAV_REQUIRED')
    size=path.stat().st_size
    if size<=44:
        raise ValueError('EMPTY_WAV_FILE')
    if size>MAX_WAV_BYTES:
        raise ValueError('WAV_FILE_TOO_LARGE')
    with wave.open(str(path),'rb') as source:
        channels=source.getnchannels()
        rate=source.getframerate()
        width=source.getsampwidth()
        frames=source.getnframes()
        duration=frames/rate if rate else 0
        if (channels not in (1,2) or rate not in (24000,48000)
                or width!=2 or source.getcomptype()!='NONE'
                or frames*channels*width>size):
            raise ValueError('INVALID_WAV_FORMAT')
        if not 0<duration<=MAX_WAV_SECONDS:
            raise ValueError('WAV_DURATION_OUT_OF_RANGE')
        if not any(source.readframes(min(frames,4096))):
            raise ValueError('SILENT_TRAINING_WAV')
    return {'path':path,'duration':duration,
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}


def run_isolated_two_stage_pilot(*,vlc,program_file,danger_wav,all_clear_wav,
                                 danger_repeats=4,ask=input,output=print,
                                 launch=None,between_s=3,final_listen_s=5,
                                 sleep=time.sleep,
                                 wait_completion=wait_for_natural_completion):
    exe=Path(vlc).resolve()
    program_file=Path(program_file).resolve()
    if not exe.is_file() or exe.name.lower()!='vlc.exe':
        raise ValueError('VLC_EXE_REQUIRED')
    if (not program_file.is_file() or program_file.suffix.lower()
            not in ('.mp3','.wav','.flac','.ogg')):
        raise ValueError('LOCAL_PROGRAM_FILE_REQUIRED')
    if type(danger_repeats) is not int or not 1<=danger_repeats<=5:
        raise ValueError('INVALID_DANGER_REPEATS')
    danger=verify_local_training_wav(danger_wav)
    clear=verify_local_training_wav(all_clear_wav)
    if danger['sha256']==clear['sha256']:
        raise ValueError('IDENTICAL_DANGER_AND_ALL_CLEAR')
    if not (0<=between_s<=30 and 0<=final_listen_s<=30):
        raise ValueError('INVALID_LISTEN_INTERVAL')
    answer=ask('AA-300/PA disconnected; headphones ONLY? Type ISOLATED: ')
    if answer.strip()!='ISOLATED':
        raise PermissionError('PHYSICAL_OUTPUT_ISOLATION_REQUIRED')

    program=LocalVlcProgram(exe,program_file,launch=launch,sleep=sleep)
    stages=[]
    if not program.start_program():
        program.cleanup()
        raise RuntimeError('PROGRAM_NOT_STARTED')
    output('LOCAL_TWO_STAGE_PROGRAM_START')
    try:
        for index,(name,asset,repeats) in enumerate((
                ('DANGER',danger,danger_repeats),
                ('ALL_CLEAR',clear,1))):
            def play_training(count):
                session=AlarmPlaybackSession(
                    lambda path:program.launch(path),isolation_verified=True)
                accepted=session.start(event_id='isolated-'+name.lower(),
                                       file=asset['path'],repeats=count,
                                       authorized=True)
                if not accepted['accepted']:
                    raise RuntimeError('LOCAL_STAGE_START_DENIED')
                try:
                    max_wait=min(600,max(20,asset['duration']*count+20))
                    return wait_completion(session,timeout_s=max_wait)
                except BaseException:
                    stopped=session.stop()
                    if not stopped.get('stopConfirmed'):
                        raise RuntimeError('LOCAL_STAGE_STOP_UNCONFIRMED')
                    raise

            result=run_isolated_handover(
                is_isolated=True,pause_program=program.pause_program,
                play_training=play_training,resume_program=program.start_program,
                confirm_restored=program.restored,repeats=repeats)
            stages.append({'stage':name,'repeats':repeats,'ok':result.ok,
                           'natural':result.alarm_natural_completion,
                           'programRestored':result.program_restored,
                           'reason':result.reason})
            output('LOCAL_TWO_STAGE_RESULT',stages[-1])
            if not result.ok:
                return {'ok':False,'stages':stages,'reason':name+'_'+result.reason,
                        'publicPlaybackAuthorized':False,'physicalPAConfirmed':False}
            if index==0 and between_s:
                sleep(between_s)
            if index==1 and final_listen_s:
                sleep(final_listen_s)
        return {'ok':True,'stages':stages,
                'reason':'ISOLATED_TWO_STAGE_AUDIO_COMPLETE',
                'publicPlaybackAuthorized':False,'physicalPAConfirmed':False}
    finally:
        program.cleanup()


def main():
    p=argparse.ArgumentParser(description='Headphones-only danger/clear local audio rehearsal')
    p.add_argument('--vlc',required=True)
    p.add_argument('--program-file',required=True)
    p.add_argument('--danger-wav',required=True)
    p.add_argument('--all-clear-wav',required=True)
    p.add_argument('--danger-repeats',type=int,default=4)
    args=p.parse_args()
    result=run_isolated_two_stage_pilot(
        vlc=args.vlc,program_file=args.program_file,
        danger_wav=args.danger_wav,all_clear_wav=args.all_clear_wav,
        danger_repeats=args.danger_repeats)
    if not result['ok']:
        raise SystemExit('ISOLATED_TWO_STAGE_FAILED_'+result['reason'])
    print('ISOLATED_TWO_STAGE_COMPLETE',flush=True)


if __name__=='__main__':
    main()
