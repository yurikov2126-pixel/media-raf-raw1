import unittest
from mchs_lab_observer_failsafe import observer_failsafe

class ObserverFailsafeTests(unittest.TestCase):
    def decide(self, **kw):
        args=dict(now=100.,last_seen_at=97.,automatic_trial_active=True,
                  one_shot_armed=False,expires_at=140.)
        args.update(kw)
        return observer_failsafe(**args)

    def test_fresh_observer_keeps_lab(self):
        self.assertFalse(self.decide()['stop_trial'])
    def test_stale_observer_stops_automatic_lab(self):
        self.assertTrue(self.decide(last_seen_at=90.)['stop_trial'])
    def test_zero_observation_fails_closed(self):
        self.assertTrue(self.decide(last_seen_at=0.)['stop_trial'])
    def test_manual_trial_not_stopped_by_observer(self):
        self.assertFalse(self.decide(automatic_trial_active=False,last_seen_at=0.)['stop_trial'])
    def test_arm_expires(self):
        self.assertTrue(self.decide(one_shot_armed=True,expires_at=100.)['cancel_arm'])
    def test_stale_cancels_arm(self):
        self.assertTrue(self.decide(one_shot_armed=True,last_seen_at=80.)['cancel_arm'])
    def test_fresh_arm_is_retained(self):
        self.assertFalse(self.decide(one_shot_armed=True)['cancel_arm'])

if __name__ == '__main__':
    unittest.main()
