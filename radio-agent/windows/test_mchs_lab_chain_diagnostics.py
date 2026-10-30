import unittest
from mchs_lab_chain_diagnostics import assess_lab_chain

class ChainDiagnosticsTests(unittest.TestCase):
    def status(self, **changes):
        data=dict(observer_fresh=True,worker_phase='ALERT',authorized=True,
                  primary_alive=True,reserve_alive=False,output_state='AVAILABLE',
                  lab_connected=True,pcm_age_seconds=0.2,trial_active=True)
        data.update(changes)
        return assess_lab_chain(**data)
    def test_observed_not_real_ready(self):
        d=self.status()
        self.assertTrue(d['labObservationComplete'])
        self.assertFalse(d['realEmergencyReady'])
        self.assertFalse(d['audibleOutputVerified'])
        self.assertFalse(d['physicalPAPathVerified'])
    def test_program_intentionally_suspended_during_lab(self):
        d=self.status(primary_alive=False,reserve_alive=False,trial_active=True)
        self.assertEqual(d['checks']['program_source'],'INTENTIONALLY_SUSPENDED')
        self.assertFalse(d['realEmergencyReady'])
        self.assertFalse(d['physicalPAPathVerified'])
        self.assertTrue(d['labObservationComplete'])

    def test_no_program_without_trial_is_missing(self):
        d=self.status(primary_alive=False,reserve_alive=False,trial_active=False)
        self.assertEqual(d['checks']['program_source'],'MISSING')
        self.assertFalse(d['labObservationComplete'])

    def test_stale_pcm(self):
        self.assertEqual(self.status(pcm_age_seconds=6)['checks']['lab_pcm'],'STALE')
        self.assertFalse(self.status(pcm_age_seconds=6)['labObservationComplete'])
    def test_disconnected_pcm(self):
        self.assertEqual(self.status(lab_connected=False)['checks']['lab_pcm'],'UNCONNECTED')
    def test_observer_timeout(self):
        self.assertFalse(self.status(observer_fresh=False)['labObservationComplete'])
    def test_missing_program(self):
        self.assertEqual(self.status(primary_alive=False,reserve_alive=False,trial_active=False)['checks']['program_source'],'MISSING')
    def test_not_testing(self):
        self.assertEqual(self.status(trial_active=False)['checks']['lab_pcm'],'NOT_TESTING')
    def test_output_unknown(self):
        self.assertFalse(self.status(output_state='UNKNOWN')['labObservationComplete'])

if __name__=='__main__':
    unittest.main()
