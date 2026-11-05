import unittest
from mchs_synthetic_relay_pilot import decide_synthetic_relay_pilot

VALID_ID='synthetic_'+'a'*24+'_danger'
BASE={'isolated':True,'operator_armed':True,'stop_requested':False,
      'event_id':VALID_ID,'audio_mode':'MCHS_EVENT_ISOLATED_LOCAL_WAV',
      'server_permit':True,'now':100,'armed_until':600}

class SyntheticRelayHardwarePilotTests(unittest.TestCase):
    def test_only_current_synthetic_locally_playing_wav_can_power_relay(self):
        self.assertEqual(decide_synthetic_relay_pilot(**BASE),
                         (True,'SYNTHETIC_LOCAL_WAV_POWER_TRIAL'))
        clear={**BASE,'event_id':VALID_ID.replace('danger','clear')}
        self.assertEqual(decide_synthetic_relay_pilot(**clear)[0],True)

    def test_actual_android_event_never_energizes_hardware(self):
        for event_id in ['danger_1','cmx123','synthetic_bad_danger',
                         'synthetic_'+'a'*24+'_other',None]:
            with self.subTest(event_id=event_id):
                self.assertFalse(decide_synthetic_relay_pilot(
                    **{**BASE,'event_id':event_id})[0])

    def test_pre_roll_requires_matching_synthetic_event_and_server_permit(self):
        prepared={**BASE,'event_id':VALID_ID,'preparing_event_id':VALID_ID,
                  'audio_mode':'MCHS_RELAY_PRE_ROLL'}
        self.assertEqual(decide_synthetic_relay_pilot(**prepared),
                         (True,'SYNTHETIC_RELAY_PRE_ROLL'))
        for patch in [{'server_permit':False},
                      {'preparing_event_id':'real-event'},
                      {'event_id':'real-event'},
                      {'stop_requested':True}]:
            with self.subTest(patch=patch):
                self.assertFalse(decide_synthetic_relay_pilot(
                    **{**prepared,**patch})[0])

    def test_manual_on_only_bounded_without_any_active_event(self):
        manual={**BASE,'event_id':None,'audio_mode':'CENTRAL',
                'manual_test_until':105}
        self.assertEqual(decide_synthetic_relay_pilot(**manual),
                         (True,'OPERATOR_MANUAL_RELAY_PULSE'))
        for patch in [{'now':105},{'server_permit':False},
                      {'event_id':'real-event'},{'event_id':VALID_ID},
                      {'preparing_event_id':VALID_ID},{'operator_armed':False},
                      {'stop_requested':True}]:
            with self.subTest(patch=patch):
                self.assertFalse(decide_synthetic_relay_pilot(
                    **{**manual,**patch})[0])

    def test_server_denial_stop_expiry_or_missing_operator_arm_force_off(self):
        for change in [{'server_permit':False},{'stop_requested':True},
                       {'now':600},{'now':601},{'armed_until':None},
                       {'operator_armed':False},{'isolated':False},
                       {'audio_mode':'CENTRAL'},
                       {'audio_mode':'STOPPED'},
                       {'audio_mode':'MCHS_EVENT_ISOLATED_LOCAL_WAV','event_id':None}]:
            with self.subTest(change=change):
                self.assertFalse(decide_synthetic_relay_pilot(**{**BASE,**change})[0])

if __name__=='__main__':
    unittest.main()
