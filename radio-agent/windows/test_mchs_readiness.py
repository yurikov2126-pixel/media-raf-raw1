import unittest
from mchs_readiness import assess_mchs_readiness

class MchsReadinessTests(unittest.TestCase):
    def check(self, **changes):
        data=dict(primary_alive=True,reserve_alive=False,last_packet_age_ms=40,
                  output_state='AVAILABLE',authorized=True,worker_phase='ALERT')
        data.update(changes)
        return assess_mchs_readiness(**data)

    def test_observable_does_not_claim_audio_or_pa_verification(self):
        state=self.check()
        self.assertEqual(state['code'],'OBSERVABLE_ONLY')
        self.assertFalse(state['audioInterruptionVerified'])
        self.assertFalse(state['paOutputVerified'])
        self.assertFalse(state['physicalPriorityVerified'])

    def test_stale_authorization_takes_priority(self):
        self.assertEqual(self.check(authorized=False)['code'],'AUTHORIZATION_STALE')

    def test_disconnected_playback(self):
        self.assertEqual(self.check(primary_alive=False)['code'],'NO_LOCAL_PLAYBACK')

    def test_stale_primary_pcm(self):
        self.assertEqual(self.check(last_packet_age_ms=5000)['code'],'PRIMARY_AUDIO_STALE')

    def test_unknown_output_never_claims_verification(self):
        result=self.check(output_state='UNKNOWN')
        self.assertEqual(result['code'],'OUTPUT_UNVERIFIED')
        self.assertFalse(result['paOutputVerified'])

    def test_reserve_is_visible_not_mistaken_for_primary(self):
        result=self.check(primary_alive=False,reserve_alive=True)
        self.assertTrue(result['reserveAlive'])
        self.assertEqual(result['code'],'OBSERVABLE_ONLY')

if __name__=='__main__':
    unittest.main()
