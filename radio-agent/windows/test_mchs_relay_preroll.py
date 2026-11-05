import unittest
from mchs_relay_preroll import gate_synthetic_wav
from mchs_synthetic_relay_pilot import (decide_synthetic_relay_pilot,
                                         decide_isolated_manual_relay_test)

EVENT='synthetic_'+'a'*24+'_danger'
class MchsThreeSecondHardwareGateTests(unittest.TestCase):
    def params(self,**patch):
        return {**dict(event_id=EVENT,relay_event_id=EVENT,relay_on_at=101.,
            last_lease_at=102.,now=104.,requested_at=100.,
            server_ok=True,stop=False),**patch}

    def test_wav_starts_only_three_seconds_after_ack_and_fresh_lease(self):
        self.assertEqual(gate_synthetic_wav(**self.params(now=103.99))[0],'WAIT')
        self.assertEqual(gate_synthetic_wav(**self.params(now=104.0))[0],'START')
        self.assertEqual(gate_synthetic_wav(**self.params(now=107.5))[0],'START')
        self.assertEqual(gate_synthetic_wav(**self.params(now=108.1))[0],'WAIT')

    def test_missing_or_mismatched_ack_never_allows_wav(self):
        for changes in [{'relay_on_at':None},{'relay_event_id':None},
                        {'relay_event_id':'synthetic_'+'b'*24+'_danger'},
                        {'relay_on_at':99},{'last_lease_at':100},
                        {'relay_on_at':101,'now':103.5}]:
            with self.subTest(changes=changes):
                self.assertNotEqual(gate_synthetic_wav(**self.params(**changes))[0],'START')

    def test_timeout_stop_and_loss_of_authority_abort(self):
        for changes in [{'now':120.1},{'server_ok':False},{'stop':True},
                        {'event_id':'real_android_warning'}]:
            with self.subTest(changes=changes):
                self.assertEqual(gate_synthetic_wav(**self.params(**changes))[0],'ABORT')

    def test_preparing_relay_on_only_for_synthetic_verified_event(self):
        base=dict(isolated=True,operator_armed=True,stop_requested=False,
          event_id=EVENT,audio_mode='CENTRAL',server_permit=True,
          now=101.,armed_until=700,preparing=True)
        self.assertTrue(decide_synthetic_relay_pilot(**base)[0])
        self.assertFalse(decide_synthetic_relay_pilot(**{**base,'preparing':False})[0])
        self.assertFalse(decide_synthetic_relay_pilot(**{**base,'event_id':'android_real_event'})[0])
        self.assertFalse(decide_synthetic_relay_pilot(**{**base,'server_permit':False})[0])

    def test_manual_relay_request_timed_out_and_requires_server_auth(self):
        base=dict(isolated=True,operator_armed=True,manual_requested=True,
          server_permit=True,stop_requested=False,audio_event_active=False,
          now=100,requested_until=110,trial_until=700)
        self.assertTrue(decide_isolated_manual_relay_test(**base)[0])
        for changes in [{'server_permit':False},{'now':110},
                        {'stop_requested':True},{'audio_event_active':True},
                        {'operator_armed':False},{'manual_requested':False},
                        {'trial_until':99},{'isolated':False}]:
            with self.subTest(changes=changes):
                self.assertFalse(decide_isolated_manual_relay_test(**{**base,**changes})[0])

if __name__=='__main__':
    unittest.main()
