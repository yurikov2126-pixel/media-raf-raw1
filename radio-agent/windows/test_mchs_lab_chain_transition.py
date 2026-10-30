import unittest
from mchs_lab_chain_transition import LabChainTransition

class ChainTransitionTests(unittest.TestCase):
    def test_baseline_change_and_recovery(self):
        tracker=LabChainTransition()
        healthy={'mode':'DIAGNOSTIC_ONLY','checks':{'observer':'OBSERVED','lab_pcm':'OBSERVED'}}
        baseline=tracker.observe(healthy)
        self.assertEqual(baseline['event'],'BASELINE')
        self.assertIsNone(tracker.observe(healthy))
        broken={'mode':'DIAGNOSTIC_ONLY','checks':{'observer':'STALE','lab_pcm':'OBSERVED'}}
        failure=tracker.observe(broken)
        self.assertEqual(failure['changes']['observer'],{'from':'OBSERVED','to':'STALE'})
        self.assertFalse(failure['realEmergencyReady'])
        recovery=tracker.observe(healthy)
        self.assertEqual(recovery['changes']['observer'],{'from':'STALE','to':'OBSERVED'})
        self.assertFalse(recovery['physicalPAPathVerified'])
    def test_invalid_payload_ignored(self):
        tracker=LabChainTransition()
        self.assertIsNone(tracker.observe({'mode':'ACTIVE','checks':{'observer':'OBSERVED'}}))
        self.assertIsNone(tracker.observe(None))

if __name__=='__main__':
    unittest.main()
