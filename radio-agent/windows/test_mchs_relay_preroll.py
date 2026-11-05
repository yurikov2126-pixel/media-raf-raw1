import unittest
from mchs_relay_preroll import preroll_decision

ID='synthetic_'+'a'*24+'_danger'
BASE={'event_id':ID,'requested_at':100.0,'now':104.2,
      'ack_event_id':ID,'first_ack_at':101.0,'last_ack_at':103.0,
      'authorized':True,'stopped':False}

class MchsRelayPrerollTests(unittest.TestCase):
    def test_no_wav_before_three_seconds_since_ack(self):
        for time in [100.0,101.0,102.5,103.999]:
            state=preroll_decision(**{**BASE,'now':time})
            self.assertNotEqual(state,'READY')
        self.assertEqual(preroll_decision(**BASE),'READY')

    def test_stale_ack_or_mismatched_event_blocks_play(self):
        variants=[
            {'ack_event_id':None},{'ack_event_id':'synthetic_'+'b'*24+'_danger'},
            {'first_ack_at':None},{'first_ack_at':99.0},
            {'last_ack_at':99.0},{'last_ack_at':100.0},{'last_ack_at':None},
            {'authorized':False},{'stopped':True},
            {'event_id':'real_android_danger'}]
        for variant in variants:
            with self.subTest(variant=variant):
                self.assertNotEqual(preroll_decision(**{**BASE,**variant}),'READY')

    def test_timeout_fails_closed_and_only_new_cycle_can_retry(self):
        self.assertEqual(preroll_decision(**{**BASE,'now':116.0}),'TIMEOUT')
        self.assertEqual(preroll_decision(**{**BASE,'now':120.0}),'TIMEOUT')
        self.assertEqual(preroll_decision(**{**BASE,'now':102.0,
                         'ack_event_id':None}),'WAITING_POWER_ACK')

if __name__=='__main__':
    unittest.main()
