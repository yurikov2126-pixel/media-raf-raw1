import unittest
from unittest.mock import patch, MagicMock
from local_speaker_check import LocalSpeakerCheck, MAX_SECONDS, TEXT

class SpeakerCheckTests(unittest.TestCase):
    def test_fixed_non_emergency_message_and_time_limit(self):
        self.assertLessEqual(MAX_SECONDS, 10)
        self.assertIn("не тревога", TEXT.lower())

    @patch("local_speaker_check.threading.Thread")
    @patch("local_speaker_check.threading.Timer")
    @patch("local_speaker_check.subprocess.Popen")
    def test_start_once_and_operator_stop(self, popen, timer, thread):
        proc=MagicMock()
        proc.poll.return_value=None
        popen.return_value=proc
        check=LocalSpeakerCheck()
        self.assertTrue(check.start())
        self.assertFalse(check.start())
        self.assertEqual(popen.call_count,1)
        self.assertEqual(timer.call_args.args[0],MAX_SECONDS)
        self.assertTrue(timer.call_args.kwargs.get("daemon",False) or timer.return_value.daemon)
        check.stop()
        proc.kill.assert_called_once()
        self.assertFalse(check.active)

if __name__=="__main__":
    unittest.main()
