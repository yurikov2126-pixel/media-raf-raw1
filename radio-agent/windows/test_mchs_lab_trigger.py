import unittest
from mchs_lab_trigger import next_lab_trigger

class OneShotTriggerTests(unittest.TestCase):
    def test_only_expected_program_to_alert(self):
        transition={'transitionState':'EXPECTED','previousPhase':'PROGRAM',
                    'currentPhase':'ALERT','missedRevisions':0,'mode':'OBSERVE_ONLY'}
        self.assertTrue(next_lab_trigger(transition,armed=True,expires_at=100,now=50))
        self.assertFalse(next_lab_trigger(transition,armed=False,expires_at=100,now=50))
        self.assertFalse(next_lab_trigger(transition,armed=True,expires_at=50,now=50))
        for key,value in [('transitionState','BASELINE'),('transitionState','MISSED_REVISIONS'),
                          ('previousPhase','IDLE'),('currentPhase','PROGRAM'),
                          ('missedRevisions',1),('mode','LIVE')]:
            changed=dict(transition)
            changed[key]=value
            self.assertFalse(next_lab_trigger(changed,armed=True,expires_at=100,now=50))
    def test_missing_transition(self):
        self.assertFalse(next_lab_trigger(None,armed=True,expires_at=100,now=50))

if __name__ == '__main__':
    unittest.main()
