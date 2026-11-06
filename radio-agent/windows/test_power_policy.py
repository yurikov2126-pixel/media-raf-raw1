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

    def test_manual_authorization_allows_no_audio_and_stopped_radio(self):
        self.assertEqual(allowed_power(True, False, True, 0, 100,
                                       manual_override=True),
                         (True, "SERVER_AUTHORIZED_MANUAL"))

    def test_manual_explicit_server_off_is_immediate(self):
        self.assertEqual(allowed_power(False, False, True, 0, 100,
                                       manual_override=True),
                         (False, "SERVER_OR_NETWORK_OFF"))

    def test_auto_always_requires_local_audio_even_after_manual_mode(self):
        self.assertEqual(allowed_power(True, False, True, 0, 101),
                         (False, "LOCAL_STOP"))
        self.assertEqual(allowed_power(True, True, False, 0, 101),
                         (False, "AUDIO_TIMEOUT"))

    def test_broadcast_with_stale_audio_is_not_authorized_without_manual(self):
        self.assertEqual(allowed_power(True, True, False, 10, 50),
                         (False, "AUDIO_TIMEOUT"))

    def test_manual_override_not_a_network_bypass(self):
        self.assertFalse(allowed_power(False, True, False, 99, 100,
                                       manual_override=True)[0])


if __name__ == "__main__":
    unittest.main()
