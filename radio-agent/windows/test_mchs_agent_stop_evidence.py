import unittest
from mchs_agent_stop_evidence import trial_stop_evidence
class Process:
    def __init__(self, status): self.status=status
    def poll(self): return self.status
class TestStopEvidence(unittest.TestCase):
    def test_stopped_process_and_relay(self):
        result=trial_stop_evidence(Process(0),True)
        self.assertTrue(result['stopConfirmed'])
        self.assertFalse(result['stationPlaybackStoppedVerified'])
    def test_running_process_is_not_confirmed(self):
        self.assertFalse(trial_stop_evidence(Process(None),True)['stopConfirmed'])
    def test_uncertain_relay_is_not_confirmed(self):
        self.assertFalse(trial_stop_evidence(Process(0),False)['stopConfirmed'])
    def test_absent_process_is_not_confirmed(self):
        self.assertFalse(trial_stop_evidence(None,True)['stopConfirmed'])
if __name__=='__main__': unittest.main()
