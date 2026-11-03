import unittest
from mchs_central_return_monitor import CentralReturnMonitor

class ReturnMonitorTests(unittest.TestCase):
    def test_requires_real_packet_forward_after_trial_end(self):
        m=CentralReturnMonitor()
        self.assertTrue(m.arm(ended_at=100,packet_count=8,trial_exited=True))
        # A VLC process alone is not proof.
        a=m.observe(now=101,packet_count=8,last_packet_at=101,
                    primary_alive=True,relay_failed=False)
        self.assertEqual(a['status'],'PENDING')
        # Stale/pre-event bytes also cannot prove restoration.
        a=m.observe(now=102,packet_count=9,last_packet_at=99,
                    primary_alive=True,relay_failed=False)
        self.assertEqual(a['status'],'PENDING')
        a=m.observe(now=103,packet_count=10,last_packet_at=102,
                    primary_alive=True,relay_failed=False)
        self.assertEqual(a['status'],'CONFIRMED')
        self.assertFalse(a['physicalAudibilityVerified'])
        self.assertIsNone(m.pending)

    def test_reserve_not_mistaken_for_central(self):
        m=CentralReturnMonitor(timeout_s=5)
        m.arm(ended_at=100,packet_count=4,trial_exited=True)
        a=m.observe(now=106,packet_count=4,last_packet_at=0,
                    primary_alive=False,relay_failed=True,reserve_alive=True)
        self.assertEqual(a['status'],'UNCONFIRMED')
        self.assertEqual(a['reason'],'LOCAL_RESERVE_ONLY')

    def test_timeouts_and_failed_relay_never_claim_confirmation(self):
        m=CentralReturnMonitor(timeout_s=5)
        m.arm(ended_at=100,packet_count=3,trial_exited=True)
        a=m.observe(now=101,packet_count=5,last_packet_at=101,
                    primary_alive=True,relay_failed=True)
        self.assertEqual(a['status'],'PENDING')
        a=m.observe(now=106,packet_count=5,last_packet_at=101,
                    primary_alive=False,relay_failed=True)
        self.assertEqual(a['status'],'UNCONFIRMED')

    def test_cannot_arm_before_test_process_exit(self):
        m=CentralReturnMonitor()
        self.assertFalse(m.arm(ended_at=100,packet_count=0,trial_exited=False))
        self.assertIsNone(m.pending)

    def test_no_observation_without_trial_and_invalid_counters(self):
        m=CentralReturnMonitor()
        self.assertIsNone(m.observe(now=101,packet_count=1,last_packet_at=101,
                                    primary_alive=True,relay_failed=False))
        m.arm(ended_at=100,packet_count=5,trial_exited=True)
        a=m.observe(now=101,packet_count=4,last_packet_at=101,
                    primary_alive=True,relay_failed=False)
        self.assertEqual(a['status'],'PENDING')

if __name__=='__main__':
    unittest.main()
