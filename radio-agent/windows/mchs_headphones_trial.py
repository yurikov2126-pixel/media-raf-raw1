"""Operator-controlled local WAV trial for the Windows Radio Agent workstation.

Separate from real MCHS START: only three identification beeps from the
device-authenticated same-origin API. No ESP32/relay/PA operations.
"""
import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import time
import wave
from urllib.request import Request, urlopen

from mchs_alarm_playback import AlarmPlaybackSession

SELF_TEST_PATH='/api/radio-agent/agent/mchs-headphones-self-test.wav'
EXPECTED_BYTES=384044

def fetch_self_test(server,token,*,opener=urlopen):
    if not isinstance(server,str) or not server.startswith('https://'):
        raise ValueError('HTTPS_REQUIRED')
    if not isinstance(token,str) or not token.startswith('rr_'):
        raise ValueError('DEVICE_TOKEN_REQUIRED')
    request=Request(server.rstrip('/')+SELF_TEST_PATH,
        headers={'Authorization':'Bearer '+token,
                 'User-Agent':'MediaRafRadioAgent/HeadphonesTrial'})
    with opener(request,timeout=8) as response:
        if response.headers.get('Content-Type','').split(';')[0].strip()!='audio/wav':
            raise ValueError('NOT_WAV')
        data=response.read(EXPECTED_BYTES+1)
    if len(data)!=EXPECTED_BYTES:
        raise ValueError('INVALID_SELF_TEST_LENGTH')
    return data

def verify_self_test(file):
    if file.stat().st_size!=EXPECTED_BYTES:
        raise ValueError('INVALID_SELF_TEST_LENGTH')
    with wave.open(str(file),'rb') as audio:
        if (audio.getnchannels()!=2 or audio.getsampwidth()!=2 or
            audio.getframerate()!=48000 or audio.getnframes()!=96000 or
            audio.getcomptype()!='NONE'):
            raise ValueError('INVALID_SELF_TEST_FORMAT')
        if not any(audio.readframes(96000)):
            raise ValueError('SILENT_SELF_TEST')
    return hashlib.sha256(file.read_bytes()).hexdigest()

def wait_for_natural_completion(session, *, timeout_s=60,
                                clock=time.monotonic, sleep=time.sleep):
    """Require completed process exits for every repeat; never infer success from START."""
    if not isinstance(timeout_s,(int,float)) or timeout_s<=0 or timeout_s>600:
        raise ValueError('INVALID_COMPLETION_TIMEOUT')
    deadline=clock()+timeout_s
    while clock()<deadline:
        state=session.status()
        if (state['state']=='COMPLETED' and
            state['naturalCompletion'] is True and
            state['completedRepeats']==state['expectedRepeats'] and
            state['processRunning'] is False):
            return state
        if state['state']=='STOPPED' or state['failureReason']:
            raise RuntimeError('LOCAL_COMPLETION_FAILED_'+str(state['failureReason']))
        sleep(0.1)
    raise TimeoutError('LOCAL_COMPLETION_TIMEOUT')


def run_local_trial(server,token,vlc,*,repeats=5,opener=urlopen,
                    ask=input,output=print,launch=None,
                    natural_completion=False,completion_timeout_s=60,
                    wait_completion=wait_for_natural_completion):
    if type(repeats) is not int or repeats not in range(1,6):
        raise ValueError('INVALID_REPEATS')
    executable=Path(vlc).resolve()
    if not executable.is_file() or executable.name.lower()!='vlc.exe':
        raise ValueError('VLC_EXE_REQUIRED')
    data=fetch_self_test(server,token,opener=opener)
    with tempfile.TemporaryDirectory(prefix='mediaraf-headphones-') as temp:
        file=Path(temp)/'self-test.wav'
        file.write_bytes(data)
        digest=verify_self_test(file)
        output('SELF_TEST_SHA256',digest)
        # This confirmation is a physical operator assertion, not a remote
        # proof that the loudspeakers are disconnected.
        answer=ask('Amplifier unplugged, headphones connected? Type ISOLATED: ')
        if answer.strip()!='ISOLATED':
            raise PermissionError('OUTPUT_ISOLATION_NOT_CONFIRMED')
        if launch is None:
            def launch(audio):
                return subprocess.Popen([str(executable),'--intf','dummy',
                    '--no-video','--no-one-instance','--play-and-exit',str(audio)],
                    stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL)
        session=AlarmPlaybackSession(launch,isolation_verified=True)
        result=session.start(event_id='local-headphones-self-test',
                             file=file,repeats=repeats,authorized=True)
        if not result['accepted']:
            raise RuntimeError('LOCAL_START_DENIED_'+str(result['reason']))
        output('LOCAL_START',session.status())
        if natural_completion:
            try:
                completed=wait_completion(session,timeout_s=completion_timeout_s)
                output('LOCAL_COMPLETE',completed)
                return completed
            except BaseException:
                # On timeout, interruption, or failed playback ensure no local
                # VLC process remains before bubbling the failure to operator.
                stopped=session.stop()
                output('LOCAL_FAULT_STOP',stopped)
                if not stopped.get('stopConfirmed'):
                    raise RuntimeError('LOCAL_STOP_NOT_CONFIRMED')
                raise
        try:
            ask('Press Enter to STOP the test playback: ')
        finally:
            stopped=session.stop()
            output('LOCAL_STOP',stopped)
            if not stopped.get('stopConfirmed'):
                raise RuntimeError('LOCAL_STOP_NOT_CONFIRMED')
        return stopped

def main():
    parser=argparse.ArgumentParser(description='Local isolated headphones START/STOP trial')
    parser.add_argument('--server',default='https://mediarafraw.ru')
    parser.add_argument('--vlc',required=True)
    parser.add_argument('--repeats',type=int,default=5)
    parser.add_argument('--natural',action='store_true',
                        help='Wait for every WAV repeat to finish naturally')
    parser.add_argument('--completion-timeout',type=float,default=60)
    args=parser.parse_args()
    run_local_trial(args.server,os.environ.get('RADIO_AGENT_TOKEN',''),
                    args.vlc,repeats=args.repeats,
                    natural_completion=args.natural,
                    completion_timeout_s=args.completion_timeout)

if __name__=='__main__':
    main()
