import unittest
from mchs_lab_resume import should_stop_auto_lab

class LabResumeTests(unittest.TestCase):
    def transition(self,**changes):
        t=dict(previousPhase='ALERT',currentPhase='PROGRAM',
               transitionState='EXPECTED',mode='OBSERVE_ONLY')
        t.update(changes)
        return t
    def test_resume_stops(self):
        self.assertTrue(should_stop_auto_lab(self.transition(),auto_active=True))
    def test_stop_stops(self):
        self.assertTrue(should_stop_auto_lab(self.transition(currentPhase='IDLE'),auto_active=True))
    def test_missed_revision_stops(self):
        self.assertTrue(should_stop_auto_lab(self.transition(transitionState='MISSED_REVISIONS'),auto_active=True))
    def test_manual_preview_unaffected(self):
        self.assertFalse(should_stop_auto_lab(self.transition(),auto_active=False))
    def test_no_reverse_or_baseline(self):
        self.assertFalse(should_stop_auto_lab(self.transition(previousPhase='PROGRAM',currentPhase='ALERT'),auto_active=True))
        self.assertFalse(should_stop_auto_lab(self.transition(transitionState='BASELINE'),auto_active=True))
    def test_non_lab_ignored(self):
        self.assertFalse(should_stop_auto_lab(self.transition(mode='LIVE'),auto_active=True))

if __name__ == '__main__':
    unittest.main()
