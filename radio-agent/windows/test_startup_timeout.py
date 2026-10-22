import tempfile
import unittest
from unittest.mock import patch, Mock
from types import SimpleNamespace
from central_playout import run, STOP

class StartupNetworkRetryTests(unittest.TestCase):
    @patch('central_playout.get_status')
    def test_timeout_keeps_waiting_without_starting_vlc(self, get_status):
        get_status.side_effect=TimeoutError('network')
        with tempfile.TemporaryDirectory() as directory:
            args=SimpleNamespace(server='https://example.test',data_dir=directory,
                vlc='vlc.exe',offline_grace=900)
            STOP.clear()
            original_wait=STOP.wait
            try:
                def cancel_after_first_retry(seconds):
                    self.assertGreater(seconds,0)
                    STOP.set()
                    return True
                with patch.object(STOP,'wait',side_effect=cancel_after_first_retry):
                    run(args,'rr_test')
            finally:
                STOP.clear()
        self.assertEqual(get_status.call_count,1)

    @patch('central_playout.get_status',return_value={'mode':'SYNC_ONLY','playbackEnabled':False})
    def test_server_denial_is_not_retried(self, get_status):
        with tempfile.TemporaryDirectory() as directory:
            args=SimpleNamespace(server='https://example.test',data_dir=directory,
                vlc='vlc.exe',offline_grace=900)
            STOP.clear()
            with patch.object(STOP,'wait',side_effect=AssertionError('Denial must not retry')):
                with self.assertRaises(PermissionError):
                    run(args,'rr_test')

if __name__=='__main__':
    unittest.main()
