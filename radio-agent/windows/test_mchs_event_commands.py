import datetime
import unittest
from mchs_event_commands import validate_command

NOW = datetime.datetime(2026, 11, 3, 12, tzinfo=datetime.timezone.utc)
CMD = dict(version=1, action='START', sequence=1, eventId='event-1',
           eventType='MISSILE_DANGER', assetId='alarm', repeats=2,
           officialSourceVerified=True,
           createdAt='2026-11-03T11:59:59Z', expiresAt='2026-11-03T12:00:15Z')

class MchsEventCommandTests(unittest.TestCase):
    def test_admission(self):
        self.assertTrue(validate_command(CMD, halted=False, now=NOW)[0])
    def test_halt_and_replay(self):
        self.assertEqual(validate_command(CMD, now=NOW)[1], 'HALT_ACTIVE')
        self.assertFalse(validate_command(CMD, halted=False, last_sequence=1, now=NOW)[0])
    def test_stop_allowed_during_halt(self):
        self.assertTrue(validate_command({**CMD, 'action':'STOP'}, now=NOW)[0])
    def test_invalid_source_and_stale(self):
        self.assertFalse(validate_command({**CMD, 'officialSourceVerified':False}, halted=False, now=NOW)[0])
        self.assertFalse(validate_command(CMD, halted=False, now=NOW+datetime.timedelta(minutes=2))[0])

if __name__ == '__main__':
    unittest.main()
