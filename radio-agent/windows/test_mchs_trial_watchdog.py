import unittest
from mchs_trial_watchdog import trial_stop_reason

class WatchdogTests(unittest.TestCase):
    def reason(self, **changes):
        data=dict(now=100., started_at=90., connected_at=91., last_pcm_at=99.,
                  stop_requested=False,armed=True,authorized=True,vlc_running=True)
        data.update(changes)
        return trial_stop_reason(**data)
    def test_healthy(self):
        self.assertIsNone(self.reason())
    def test_operator_stop(self):
        self.assertEqual(self.reason(stop_requested=True),'OPERATOR_STOP')
    def test_disarm(self):
        self.assertEqual(self.reason(armed=False),'OPERATOR_STOP')
    def test_authorization(self):
        self.assertEqual(self.reason(authorized=False),'AUTHORIZATION_LOST')
    def test_duration(self):
        self.assertEqual(self.reason(now=120.),'MAX_DURATION')
    def test_vlc_exit(self):
        self.assertEqual(self.reason(vlc_running=False),'VLC_EXITED')
    def test_initial_connect_timeout(self):
        self.assertEqual(self.reason(connected_at=None,last_pcm_at=None),'PCM_CONNECT_TIMEOUT')
    def test_connecting_grace(self):
        self.assertIsNone(self.reason(now=95.,connected_at=None,last_pcm_at=None))
    def test_stall(self):
        self.assertEqual(self.reason(last_pcm_at=94.),'PCM_STALLED')

if __name__=='__main__':
    unittest.main()
