import unittest
from unittest.mock import patch, Mock
from audio_output_probe import inspect_outputs

class OutputProbeTests(unittest.TestCase):
    @patch('audio_output_probe.sys.platform','linux')
    def test_non_windows_is_explicit(self):
        self.assertEqual(inspect_outputs()['state'],'UNSUPPORTED')

    @patch('audio_output_probe.sys.platform','win32')
    @patch('audio_output_probe.subprocess.run')
    def test_available_endpoints(self, run):
        run.return_value=Mock(stdout='[{"FriendlyName":"Speakers","Status":"OK"},{"FriendlyName":"Headphones","Status":"Error"}]')
        self.assertEqual(inspect_outputs(),{'state':'AVAILABLE','name':'Speakers','count':1})

    @patch('audio_output_probe.sys.platform','win32')
    @patch('audio_output_probe.subprocess.run')
    def test_failed_probe_not_assumed_unavailable(self,run):
        run.side_effect=OSError('powershell missing')
        self.assertEqual(inspect_outputs()['state'],'UNKNOWN')

if __name__=='__main__':
    unittest.main()
