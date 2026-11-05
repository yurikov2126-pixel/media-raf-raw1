import unittest
from mchs_relay_transition_evidence import describe_power_transition

class RelayTransitionEvidenceTests(unittest.TestCase):
    def reason(self,previous,requested,server_permit=True,reason='SYNTHETIC_LOCAL_WAV_POWER_TRIAL',
               phase='MCHS_EVENT_ISOLATED_LOCAL_WAV',event_id='synthetic_'+('a'*24)+'_danger'):
        return describe_power_transition(previous=previous,requested=requested,
            server_permit=server_permit,reason=reason,phase=phase,event_id=event_id)

    def test_repeated_acks_are_not_repeated_transitions(self):
        self.assertIsNone(self.reason(True,True))
        self.assertIsNone(self.reason(False,False))
        self.assertEqual(self.reason(False,True)['transition'],'ON_REQUESTED')

    def test_explicit_server_denial_and_event_boundary_remain_distinct(self):
        self.assertEqual(self.reason(True,False,False,'SERVER_POWER_NOT_AUTHORIZED')['transition'],
                         'OFF_SERVER_DENIED')
        self.assertEqual(self.reason(True,False,True,'LOCAL_WAV_NOT_PLAYING')['transition'],
                         'OFF_AUDIO_BOUNDARY')

    def test_agent_stop_and_expiry(self):
        self.assertEqual(self.reason(True,False,True,'AGENT_STOP')['transition'],'OFF_AGENT_STOP')
        self.assertEqual(self.reason(True,False,True,'TRIAL_WINDOW_EXPIRED')['transition'],
                         'OFF_TRIAL_EXPIRED')
        self.assertEqual(self.reason(True,False,True,'UNKNOWN')['transition'],'OFF_LOCAL_POLICY')
        self.assertIsNone(self.reason(True,None))

    def test_no_secrets_or_pii_in_output(self):
        item=self.reason(True,False,True,'LOCAL_WAV_NOT_PLAYING')
        self.assertEqual(set(item),{'transition','phase','reason','event'})
        self.assertTrue(len(item['event'])<=128)

if __name__=='__main__':
    unittest.main()
