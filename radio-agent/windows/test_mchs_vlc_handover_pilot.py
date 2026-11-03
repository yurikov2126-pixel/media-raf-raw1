import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from mchs_vlc_handover_pilot import run_real_vlc_pilot


class FakeProcess:
    def __init__(self, returncode=None):
        self.returncode=returncode
    def poll(self):return self.returncode
    def terminate(self):self.returncode=-15
    def wait(self,timeout=None):return self.returncode
    def kill(self):self.returncode=-9


class PilotTests(unittest.TestCase):
    def files(self,td):
        vlc=Path(td)/'vlc.exe'
        vlc.write_bytes(b'fixture')
        music=Path(td)/'song.mp3'
        music.write_bytes(b'fixture')
        return vlc,music

    @patch('mchs_vlc_handover_pilot.verify_self_test',return_value='digest')
    @patch('mchs_vlc_handover_pilot.fetch_self_test',return_value=b'fixture')
    def test_actual_session_waits_for_all_four_training_exits(self,_fetch,_verify):
        with tempfile.TemporaryDirectory() as td:
            vlc,music=self.files(td)
            launched=[]
            def launch(file):
                name=Path(file).name
                process=FakeProcess(0 if name=='training.wav' else None)
                launched.append((name,process))
                return process
            messages=[]
            result=run_real_vlc_pilot(
                server='https://station.example',token='rr_example',vlc=vlc,music=music,
                launch=launch,ask=lambda _: 'ISOLATED',restored_listen_s=0,
                output=lambda *args:messages.append(args))
            self.assertTrue(result.ok)
            self.assertTrue(result.alarm_natural_completion)
            self.assertEqual([name for name,_ in launched],
                             ['song.mp3']+['training.wav']*4+['song.mp3'])
            self.assertIsNotNone(launched[0][1].poll())
            self.assertIsNotNone(launched[-1][1].poll())
            self.assertTrue(any(args[0]=='LOCAL_HANDOVER_RESULT' for args in messages))

    @patch('mchs_vlc_handover_pilot.verify_self_test',return_value='digest')
    @patch('mchs_vlc_handover_pilot.fetch_self_test',return_value=b'fixture')
    def test_isolation_denial_never_launches_audio(self,_fetch,_verify):
        with tempfile.TemporaryDirectory() as td:
            vlc,music=self.files(td)
            with self.assertRaises(PermissionError):
                run_real_vlc_pilot(
                    server='https://station.example',token='rr_example',vlc=vlc,music=music,
                    ask=lambda _: 'NO',
                    launch=lambda f:self.fail('MUST_NOT_START'))

    @patch('mchs_vlc_handover_pilot.verify_self_test',return_value='digest')
    @patch('mchs_vlc_handover_pilot.fetch_self_test',return_value=b'fixture')
    def test_failed_training_player_restores_program(self,_fetch,_verify):
        with tempfile.TemporaryDirectory() as td:
            vlc,music=self.files(td)
            launched=[]
            def launch(file):
                name=Path(file).name
                launched.append(name)
                return FakeProcess(7 if name=='training.wav' else None)
            result=run_real_vlc_pilot(
                server='https://station.example',token='rr_example',vlc=vlc,music=music,
                launch=launch,ask=lambda _: 'ISOLATED',restored_listen_s=0)
            self.assertFalse(result.ok)
            self.assertTrue(result.program_restored)
            self.assertEqual(launched,['song.mp3','training.wav','song.mp3'])

    @patch('mchs_vlc_handover_pilot.verify_self_test',return_value='digest')
    @patch('mchs_vlc_handover_pilot.fetch_self_test',return_value=b'fixture')
    def test_timeout_stops_training_before_program_return(self,_fetch,_verify):
        with tempfile.TemporaryDirectory() as td:
            vlc,music=self.files(td)
            launched=[]
            def launch(file):
                name=Path(file).name
                process=FakeProcess()
                launched.append((name,process))
                return process
            result=run_real_vlc_pilot(
                server='https://station.example',token='rr_example',vlc=vlc,music=music,
                launch=launch,ask=lambda _: 'ISOLATED',restored_listen_s=0,
                wait_completion=lambda session,timeout_s:(
                    (_ for _ in ()).throw(TimeoutError('expired'))))
            self.assertFalse(result.ok)
            self.assertTrue(result.program_restored)
            # The training session can still be starting when cancellation
            # arrives. Irrespective of order, no test-owned child remains.
            self.assertIsNotNone(launched[0][1].poll())
            self.assertIsNotNone(launched[-1][1].poll())

if __name__=='__main__':
    unittest.main()
