import unittest
from unittest.mock import Mock, patch
from audio_telemetry import playback_report, send_playback_report

class Relay:
    def __init__(self,age=None,failed=False):
        self.last_data=0 if age is None else 100-age
        self.failed=Mock()
        self.failed.is_set.return_value=failed

class AudioTelemetryTests(unittest.TestCase):
    def test_primary_receives_packets(self):
        primary=Mock()
        primary.poll.return_value=None
        self.assertEqual(playback_report(primary,None,Relay(1),100)['playback'],'PLAYING')

    def test_stale_central_stream_buffering(self):
        primary=Mock()
        primary.poll.return_value=None
        result=playback_report(primary,None,Relay(8),100)
        self.assertEqual(result['playback'],'BUFFERING')
        self.assertEqual(result['lastPacketAgeMs'],8000)
        self.assertEqual(result['source'],'CENTRAL')

    def test_reserve_is_not_reported_as_central_packets(self):
        reserve=Mock()
        reserve.poll.return_value=None
        result=playback_report(None,reserve,Relay(None),100)
        self.assertEqual(result['playback'],'PLAYING')
        self.assertIsNone(result['lastPacketAgeMs'])
        self.assertEqual(result['source'],'LOCAL_RESERVE')

    def test_failed_relay(self):
        result=playback_report(None,None,Relay(None,True),100)
        self.assertEqual(result['playback'],'ERROR')
        self.assertEqual(result['source'],'NONE')

    @patch('audio_telemetry.urlopen')
    def test_authorized_http_report(self,open_mock):
        open_mock.return_value.__enter__.return_value.status=200
        self.assertTrue(send_playback_report('https://example.test','rr_test',
            {'playback':'STOPPED','outputDevice':'VLC','lastPacketAgeMs':None,'error':''}))
        request=open_mock.call_args.args[0]
        self.assertEqual(request.get_method(),'POST')
        self.assertTrue(request.full_url.endswith('/api/radio-agent/agent/audio-telemetry'))
        self.assertEqual(request.get_header('Authorization'),'Bearer rr_test')

if __name__=='__main__':
    unittest.main()
