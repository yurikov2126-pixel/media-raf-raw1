import io
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

from mchs_headphones_trial import fetch_self_test, verify_self_test, run_local_trial, wait_for_natural_completion

class FakeResponse:
    headers={'Content-Type':'audio/wav'}
    def __init__(self,data):self.data=data
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def read(self,length):return self.data[:length]

class FakeProcess:
    def __init__(self):self.returncode=None
    def poll(self):
        if self.returncode is None:self.returncode=0
        return self.returncode
    def terminate(self):self.returncode=-15
    def wait(self,timeout=None):return self.returncode
    def kill(self):self.returncode=-9

def fixture():
    stream=io.BytesIO()
    with wave.open(stream,'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(48000)
        w.writeframes(b'\x01\x00\x01\x00'*96000)
    return stream.getvalue()

class HeadphonesTrialTests(unittest.TestCase):
    def test_valid_wav_and_device_authenticated_download(self):
        data=fixture()
        self.assertEqual(len(data),384044)
        def opener(req,timeout):
            self.assertEqual(req.full_url,'https://station.example/api/radio-agent/agent/mchs-headphones-self-test.wav')
            self.assertEqual(req.get_header('Authorization'),'Bearer rr_example')
            return FakeResponse(data)
        got=fetch_self_test('https://station.example','rr_example',opener=opener)
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'tone.wav'
            p.write_bytes(got)
            self.assertEqual(len(verify_self_test(p)),64)

    def test_fails_closed_on_wrong_data_or_http(self):
        with self.assertRaisesRegex(ValueError,'HTTPS_REQUIRED'):
            fetch_self_test('http://localhost','rr_example')
        with self.assertRaisesRegex(ValueError,'INVALID_SELF_TEST_LENGTH'):
            fetch_self_test('https://station.example','rr_example',
                            opener=lambda req,timeout:FakeResponse(b'bad'))

    def test_operator_must_confirm_isolation(self):
        with tempfile.TemporaryDirectory() as td:
            vlc=Path(td)/'vlc.exe'
            vlc.write_bytes(b'fixture')
            launches=[]
            with self.assertRaisesRegex(PermissionError,'OUTPUT_ISOLATION_NOT_CONFIRMED'):
                run_local_trial('https://station.example','rr_example',vlc,
                    opener=lambda req,timeout:FakeResponse(fixture()),
                    ask=lambda prompt:'NO',
                    launch=lambda path:launches.append(path))
            self.assertEqual(launches,[])

    def test_start_stop_local_process_without_public_agent_command(self):
        with tempfile.TemporaryDirectory() as td:
            vlc=Path(td)/'vlc.exe'
            vlc.write_bytes(b'fixture')
            logs=[]
            result=run_local_trial('https://station.example','rr_example',vlc,
                opener=lambda req,timeout:FakeResponse(fixture()),
                ask=lambda prompt:'ISOLATED' if 'ISOLATED' in prompt else '',
                output=lambda *parts:logs.append(parts),
                launch=lambda path:FakeProcess())
            self.assertTrue(result['stopConfirmed'])
            self.assertTrue(any(parts[0]=='LOCAL_START' for parts in logs))
            self.assertTrue(any(parts[0]=='LOCAL_STOP' for parts in logs))

    def test_natural_complete_without_stop(self):
        with tempfile.TemporaryDirectory() as td:
            vlc=Path(td)/'vlc.exe'
            vlc.write_bytes(b'fixture')
            logs=[]
            class Completed:
                def status(self):
                    return dict(state='COMPLETED',naturalCompletion=True,
                        completedRepeats=3,expectedRepeats=3,
                        processRunning=False,failureReason=None)
            result=run_local_trial('https://station.example','rr_example',vlc,
                repeats=3,natural_completion=True,
                opener=lambda req,timeout:FakeResponse(fixture()),
                ask=lambda prompt:'ISOLATED',output=lambda *x:logs.append(x),
                launch=lambda path:FakeProcess(),
                wait_completion=lambda session,timeout_s:wait_for_natural_completion(
                    Completed(),clock=lambda:0,sleep=lambda _:None))
            self.assertTrue(result['naturalCompletion'])
            self.assertTrue(any(x[0]=='LOCAL_COMPLETE' for x in logs))
            self.assertFalse(any(x[0]=='LOCAL_STOP' for x in logs))

    def test_natural_failure_cleans_up_process(self):
        with tempfile.TemporaryDirectory() as td:
            vlc=Path(td)/'vlc.exe'
            vlc.write_bytes(b'fixture')
            logs=[]
            with self.assertRaisesRegex(TimeoutError,'LOCAL_COMPLETION_TIMEOUT'):
                run_local_trial('https://station.example','rr_example',vlc,
                    natural_completion=True,
                    opener=lambda req,timeout:FakeResponse(fixture()),
                    ask=lambda prompt:'ISOLATED',output=lambda *x:logs.append(x),
                    launch=lambda path:FakeProcess(),
                    wait_completion=lambda session,timeout_s:(
                        (_ for _ in ()).throw(TimeoutError('LOCAL_COMPLETION_TIMEOUT'))))
            self.assertTrue(any(x[0]=='LOCAL_FAULT_STOP' and
                                x[1]['stopConfirmed'] for x in logs))

    def test_wait_completion_rejects_short_or_failed_sessions(self):
        class FakeSession:
            def __init__(self,state):self.state=state
            def status(self):return self.state
        good=dict(state='COMPLETED',naturalCompletion=True,
                  completedRepeats=2,expectedRepeats=2,
                  processRunning=False,failureReason=None)
        self.assertTrue(wait_for_natural_completion(
            FakeSession(good),clock=lambda:0,sleep=lambda _:None)['naturalCompletion'])
        bad=dict(good,completedRepeats=1,naturalCompletion=False)
        times=iter([0,1,2])
        with self.assertRaises(TimeoutError):
            wait_for_natural_completion(FakeSession(bad),timeout_s=1,
                clock=lambda:next(times),sleep=lambda _:None)
        stopped=dict(good,state='STOPPED',naturalCompletion=False,
                     failureReason='PLAYER_FAILED')
        with self.assertRaisesRegex(RuntimeError,'LOCAL_COMPLETION_FAILED'):
            wait_for_natural_completion(FakeSession(stopped),
                clock=lambda:0,sleep=lambda _:None)

if __name__=='__main__':
    unittest.main()
