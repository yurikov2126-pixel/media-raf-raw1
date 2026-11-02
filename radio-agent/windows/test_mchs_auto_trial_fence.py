import unittest
from mchs_auto_trial_fence import queued_auto_trial_current

class AutoTrialFenceTests(unittest.TestCase):
    def setUp(self):
        self.observed={'ready':True,'phase':'ALERT','revision':42,'at':100.0}
    def test_current_alert_revision(self):
        self.assertTrue(queued_auto_trial_current(self.observed,42,101.0))
    def test_reconnect_changes_phase_or_revision(self):
        for change in ({'phase':'PROGRAM'},{'phase':'IDLE'},{'revision':43}):
            self.assertFalse(queued_auto_trial_current({**self.observed,**change},42,101.0))
    def test_delayed_and_future_observations_are_rejected(self):
        self.assertFalse(queued_auto_trial_current(self.observed,42,104.1))
        self.assertFalse(queued_auto_trial_current(self.observed,42,99.0))
    def test_missing_and_corrupt_data_fail_closed(self):
        for bad in (None,{}, {'ready':False,**{k:v for k,v in self.observed.items() if k!='ready'}},
                    {**self.observed,'revision':True},{**self.observed,'at':'100'}):
            self.assertFalse(queued_auto_trial_current(bad,42,101.0))

if __name__=='__main__':
    unittest.main()
