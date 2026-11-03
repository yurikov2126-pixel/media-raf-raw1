import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from mchs_vlc_handover_pilot import run_real_vlc_pilot, LocalVlcProgram


class FakeProcess:
    def __init__(self):self.returncode=None
    def poll(self):return self.returncode
    def terminate(self):self.returncode=-15
    def wait(self,timeout=None):return self.returncode
    def kill(self):self.returncode=-9


def complete(n):
    return dict(state='COMPLETED',naturalCompletion=True,
                completedRepeats=n,expectedRepeats=n,
                failureReason=None,processRunning=False)


class PilotTests(unittest.TestCase):
    def setup_files(self,td):
        vlc=Path(td)/'vlc.exe'; vlc.write_bytes(b'fixture')
        music=Path(td)/'song.mp3'; music.write_bytes(b'test')
        return vlc,music

    @patch('mchs_vlc_handover_pilot.verify_self_test',return_value='digest')
    @patch('mchs_vlc_handover_pilot.fetch_self_test',return_value=b'fixture')
    def test_real_subprocess_adapter_order_and_cleanup(self,_fetch,_verify):
        with tempfile.TemporaryDirectory() as td:
            vlc,music=self.setup_files(td)
            launched=[]
            def launch(file):
                proc=FakeProcess()
                launched.append((Path(file).name,proc))
                return proc
            messages=[]
            result=run_real_vlc_pilot(
                server='https://station.example',token='rr_example',vlc=vlc,music=music,
                launch=launch,ask=lambda prompt:'ISOLATED',output=lambda *x:messages.append(x),
                restored_listen_s=0,
                wait_completion=lambda session,timeout_s:complete(4))
            self.assertTrue(result.ok)
            self.assertEqual([x[0] for x in launched],
                             ['song.mp3','training.wav','song.mp3'])
            self.assertIsNotNone(launched[0][1].poll())
            self.assertIsNotNone(launched[2][1].poll())
            self.assertTrue(any(x[0]=='LOCAL_HANDOVER_RESULT' for x in messages))

    @patch('mchs_vlc_handover_pilot.verify_self_test',return_value='digest')
    @patch('mchs_vlc_handover_pilot.fetch_self_test',return_value=b'fixture')
    def test_physical_isolation_denial_never_spawns_vlc(self,_fetch,_verify):
        with tempfile.TemporaryDirectory() as td:
            vlc,music=self.setup_files(td)
            with self.assertRaises(PermissionError):
                run_real_vlc_pilot(server='https://station.example',token='rr_example',
                    vlc=vlc,music=music,ask=lambda prompt:'NO',
                    launch=lambda f:self.fail('MUST_NOT_START'))

    @patch('mchs_vlc_handover_pilot.verify_self_test',return_value='digest')
    @patch('mchs_vlc_handover_pilot.fetch_self_test',return_value=b'fixture')
    def test_short_completion_fails_but_restores_program(self,_fetch,_verify):
        with tempfile.TemporaryDirectory() as td:
            vlc,music=self.setup_files(td)
            starts=[]
            result=run_real_vlc_pilot(
                server='https://station.example',token='rr_example',vlc=vlc,music=music,
                launch=lambda f:(starts.append(Path(f).name) or FakeProcess()),
                ask=lambda prompt:'ISOLATED',restored_listen_s=0,
                wait_completion=lambda session,timeout_s:complete(3))
            self.assertFalse(result.ok)
            self.assertTrue(result.program_restored)
            self.assertEqual(starts,['song.mp3','training.wav','song.mp3'])

    @patch('mchs_vlc_handover_pilot.verify_self_test',return_value='digest')
    @patch('mchs_vlc_handover_pilot.fetch_self_test',return_value=b'fixture')
    def test_timeout_stops_training_before_program_resumes(self,_fetch,_verify):
        with tempfile.TemporaryDirectory() as td:
            vlc,music=self.setup_files(td)
            processes=[]
            def launch(file):
                p=FakeProcess()
                processes.append(p)
                return p
            result=run_real_vlc_pilot(
                server='https://station.example',token='rr_example',vlc=vlc,music=music,
                launch=launch,ask=lambda prompt:'ISOLATED',restored_listen_s=0,
                wait_completion=lambda session,timeout_s:(
                    (_ for _ in ()).throw(TimeoutError('expired'))))
            self.assertFalse(result.ok)
            self.assertTrue(result.program_restored)
            self.assertEqual(len(processes),3)
            self.assertIsNotNone(processes[1].poll())

if __name__=='__main__':
    unittest.main()
