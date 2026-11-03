import datetime
import json
import tempfile
import unittest
from pathlib import Path

from mchs_event_admission import EventAdmissionLedger


NOW=datetime.datetime(2026,11,3,18,0,tzinfo=datetime.timezone.utc)


def command(seq,event,event_type='MISSILE_DANGER',action='START',repeats=4):
    return {'version':1,'action':action,'sequence':seq,'eventId':event,
            'eventType':event_type,
            'createdAt':(NOW-datetime.timedelta(seconds=2)).isoformat(),
            'expiresAt':(NOW+datetime.timedelta(seconds=20)).isoformat(),
            'officialSourceVerified':True,'assetId':'training-audio',
            'repeats':repeats}


def observe(ledger,cmd,*,isolation=True,enabled=True,halted=False):
    return ledger.observe(cmd,physical_isolation=isolation,
                          execution_enabled=enabled,halted=halted,now=NOW)


class EventAdmissionTests(unittest.TestCase):
    def test_danger_then_clear_persists_and_deduplicates_across_restart(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'ledger.json'
            gate=EventAdmissionLedger(path)
            first=observe(gate,command(1,'danger-1'))
            self.assertTrue(first['accepted'])
            self.assertFalse(first['audioStarted'])
            self.assertEqual(gate.data['phase'],'DANGER_OBSERVED')
            again=EventAdmissionLedger(path)
            duplicate=observe(again,command(2,'danger-1'))
            self.assertFalse(duplicate['accepted'])
            self.assertEqual(duplicate['reason'],'REPLAYED_EVENT')
            clear=observe(again,command(3,'clear-1','MISSILE_ALL_CLEAR',repeats=1))
            self.assertTrue(clear['accepted'])
            self.assertEqual(clear['phase'],'ALL_CLEAR_OBSERVED')
            self.assertEqual(EventAdmissionLedger(path).data['lastSequence'],3)

    def test_clear_before_danger_is_not_admitted(self):
        with tempfile.TemporaryDirectory() as tmp:
            gate=EventAdmissionLedger(Path(tmp)/'ledger.json')
            status=observe(gate,command(1,'clear','MISSILE_ALL_CLEAR',repeats=1))
            self.assertEqual(status['reason'],'DANGER_EVENT_REQUIRED')
            self.assertFalse(status['audioStarted'])

    def test_reject_nonisolated_disabled_and_halted(self):
        with tempfile.TemporaryDirectory() as tmp:
            gate=EventAdmissionLedger(Path(tmp)/'ledger.json')
            cmd=command(1,'danger')
            self.assertEqual(observe(gate,cmd,isolation=False)['reason'],'PHYSICAL_ISOLATION_REQUIRED')
            self.assertEqual(observe(gate,cmd,enabled=False)['reason'],'EXECUTION_DISABLED')
            self.assertEqual(observe(gate,cmd,halted=True)['reason'],'HALT_ACTIVE')
            self.assertEqual(gate.data['lastSequence'],0)

    def test_stop_same_event_is_allowed_and_clears_active_danger(self):
        with tempfile.TemporaryDirectory() as tmp:
            gate=EventAdmissionLedger(Path(tmp)/'ledger.json')
            observe(gate,command(1,'danger'))
            stop=observe(gate,command(2,'danger',action='STOP'),halted=True,
                         enabled=False,isolation=False)
            self.assertTrue(stop['accepted'])
            self.assertEqual(stop['phase'],'STOPPED')
            self.assertIsNone(gate.data['dangerEvent'])
            self.assertEqual(observe(gate,command(2,'danger',action='STOP'),halted=True)['reason'],
                             'INVALID_OR_REPLAYED_COMMAND')

    def test_invalid_all_clear_repeat_and_expired_not_admitted(self):
        with tempfile.TemporaryDirectory() as tmp:
            gate=EventAdmissionLedger(Path(tmp)/'ledger.json')
            self.assertEqual(observe(gate,command(1,'clear','MISSILE_ALL_CLEAR',repeats=4))['reason'],
                             'INVALID_ALL_CLEAR_REPEATS')
            expired=command(1,'old')
            expired['expiresAt']=(NOW-datetime.timedelta(seconds=1)).isoformat()
            self.assertFalse(observe(gate,expired)['accepted'])

    def test_corrupted_ledger_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'ledger.json'
            path.write_text('{wrong',encoding='utf-8')
            with self.assertRaisesRegex(RuntimeError,'MCHS_EVENT_LEDGER_UNAVAILABLE'):
                EventAdmissionLedger(path)

    def test_sequence_must_advance_even_for_different_event(self):
        with tempfile.TemporaryDirectory() as tmp:
            gate=EventAdmissionLedger(Path(tmp)/'ledger.json')
            observe(gate,command(4,'danger'))
            self.assertEqual(observe(gate,command(3,'clear','MISSILE_ALL_CLEAR',repeats=1))['reason'],
                             'INVALID_OR_REPLAYED_COMMAND')


if __name__=='__main__':
    unittest.main()
