import unittest
from power_policy import allowed_power


class PowerPolicyTests(unittest.TestCase):
    def test_active_authorized(self):
        self.assertEqual(allowed_power(True, True, False, 100, 103),
                         (True, "AUTHORIZED_PLAYBACK"))

    def test_short_gap_keeps_power(self):
        self.assertTrue(allowed_power(True, True, False, 100, 129.9)[0])

    def test_audio_gap_30_seconds_off(self):
        self.assertEqual(allowed_power(True, True, False, 100, 130),
                         (False, "AUDIO_TIMEOUT"))

    def test_manual_stop_immediate(self):
        self.assertEqual(allowed_power(True, True, True, 100, 101),
                         (False, "LOCAL_STOP"))

    def test_closed_agent_off(self):
        self.assertFalse(allowed_power(True, False, False, 100, 101)[0])

    def test_explicit_server_off(self):
        self.assertEqual(allowed_power(False, True, False, 100, 101),
                         (False, "SERVER_OR_NETWORK_OFF"))

    def test_no_audio_observed_cannot_power_on(self):
        self.assertFalse(allowed_power(True, True, False, 0, 2)[0])


if __name__ == "__main__":
    unittest.main()
