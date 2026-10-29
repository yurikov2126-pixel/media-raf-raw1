import unittest
from mchs_transition_shadow import MchsTransitionShadow

class ShadowTests(unittest.TestCase):
    def test_normal_sequence(self):
        s=MchsTransitionShadow()
        self.assertEqual(s.observe(1,'IDLE')['transitionState'],'BASELINE')
        self.assertEqual(s.observe(2,'PROGRAM')['transitionState'],'EXPECTED')
        self.assertEqual(s.observe(3,'ALERT')['transitionState'],'EXPECTED')
        self.assertEqual(s.observe(4,'PROGRAM')['transitionState'],'EXPECTED')
        self.assertEqual(s.observe(5,'IDLE')['transitionState'],'EXPECTED')
    def test_skipped_revisions_are_not_claimed_as_verified(self):
        s=MchsTransitionShadow()
        s.observe(2,'PROGRAM')
        x=s.observe(5,'ALERT')
        self.assertEqual(x['transitionState'],'MISSED_REVISIONS')
        self.assertEqual(x['missedRevisions'],2)
        self.assertIsNone(s.observe(4,'PROGRAM'))
        self.assertIsNone(s.observe(5,'ALERT'))
    def test_invalid_phase_and_revisions_are_ignored(self):
        s=MchsTransitionShadow()
        self.assertIsNone(s.observe(True,'ALERT'))
        self.assertIsNone(s.observe(2,'UNKNOWN'))
        self.assertIsNone(s.observe(-1,'IDLE'))
    def test_unexpected_phase_change_detected(self):
        s=MchsTransitionShadow()
        s.observe(1,'IDLE')
        self.assertEqual(s.observe(2,'ALERT')['transitionState'],'UNEXPECTED')

if __name__=='__main__':
    unittest.main()
