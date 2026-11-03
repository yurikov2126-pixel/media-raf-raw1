import datetime
import unittest
from mchs_event_commands import validate_command

now=datetime.datetime(2026,11,4,12,0,0,tzinfo=datetime.timezone.utc)
base={'version':1,'sequence':1,'action':'START','eventId':'android_1',
      'eventType':'MISSILE_DANGER','assetId':'isolated_danger',
      'sha256':'a'*64,'repeats':2,'officialSourceVerified':False,
      'trialOnly':True,'trialSourceAccepted':True,
      'createdAt':now.isoformat(),'expiresAt':(now+datetime.timedelta(seconds=10)).isoformat()}

class IsolatedAndroidAutoCommandTests(unittest.TestCase):
    def test_isolated_trial_source_only_is_valid_in_unhalted_state(self):
        self.assertEqual(validate_command(base,halted=False,now=now),(True,None))
        self.assertEqual(validate_command(base,halted=True,now=now)[1],'HALT_ACTIVE')
    def test_normal_source_unverified_start_remains_denied(self):
        for change in [{'trialOnly':False},{'trialSourceAccepted':False},
                       {'officialSourceVerified':None}]:
            command={**base,**change}
            self.assertEqual(validate_command(command,halted=False,now=now)[1],
                             'SOURCE_NOT_VERIFIED')
    def test_all_clear_forced_one_repeat(self):
        command={**base,'eventType':'MISSILE_ALL_CLEAR','repeats':2}
        self.assertEqual(validate_command(command,halted=False,now=now)[1],
                         'INVALID_ALL_CLEAR_REPEATS')

if __name__=='__main__':unittest.main()
