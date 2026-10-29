import unittest
from mchs_output_preflight import evaluate_isolated_output_preflight

class OutputPreflightTests(unittest.TestCase):
    def evaluate(self, **values):
        args=dict(observer={'code':'OBSERVABLE_ONLY'},
                  pa_cable_disconnected=True,separate_output_confirmed=True,
                  operator_present=True)
        args.update(values)
        return evaluate_isolated_output_preflight(**args)
    def test_complete_operator_preflight_does_not_authorize_switch(self):
        result=self.evaluate()
        self.assertTrue(result['readyForControlledAudioTrial'])
        self.assertFalse(result['hardwareSwitchAuthorized'])
        self.assertFalse(result['physicalIsolationVerifiedBySoftware'])
        self.assertFalse(result['audioInterruptionVerified'])
    def test_every_missing_gate_blocks_trial(self):
        for key,bad in [('observer',None),('pa_cable_disconnected',False),
                        ('separate_output_confirmed',False),('operator_present',False)]:
            with self.subTest(key=key):
                self.assertFalse(self.evaluate(**{key:bad})['readyForControlledAudioTrial'])
    def test_unverified_observer_fails_closed(self):
        self.assertFalse(self.evaluate(observer={'code':'OUTPUT_UNVERIFIED'})['readyForControlledAudioTrial'])
        self.assertFalse(self.evaluate(observer={'code':'AUTHORIZATION_STALE'})['readyForControlledAudioTrial'])

if __name__=='__main__':
    unittest.main()
