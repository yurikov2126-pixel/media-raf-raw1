import tempfile
import threading
import time
import unittest
from pathlib import Path
from mchs_alarm_playback import AlarmPlaybackSession

class FakeProcess:
    def __init__(self,code=0):self.returncode=None;self.code=code
    def poll(self):
        if self.returncode is None:self.returncode=self.code
        return self.returncode
    def terminate(self):self.returncode=-15
    def wait(self,timeout=None):return self.returncode
    def kill(self):self.returncode=-9

class SessionTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.file=Path(self.tmp.name)/'alarm.alarm'
        self.file.write_bytes(b'audio fixture')
    def test_isolation_and_authorization_required(self):
        s=AlarmPlaybackSession(lambda _:FakeProcess())
        self.assertFalse(s.start(event_id='event',file=self.file,repeats=1,authorized=True)['accepted'])
        s=AlarmPlaybackSession(lambda _:FakeProcess(),isolation_verified=True)
        self.assertFalse(s.start(event_id='event',file=self.file,repeats=1)['accepted'])
    def test_runs_all_repeats_without_live_output(self):
        calls=[]
        s=AlarmPlaybackSession(lambda file:(calls.append(file),FakeProcess())[1],
                               isolation_verified=True,sleep=lambda _:None)
        self.assertTrue(s.start(event_id='event',file=self.file,repeats=3,authorized=True)['accepted'])
        s._thread.join(timeout=2)
        self.assertEqual(s.status()['state'],'COMPLETED')
        self.assertEqual(s.status()['completedRepeats'],3)
        self.assertEqual(len(calls),3)
    def test_watchdog_aborts_before_launch(self):
        s=AlarmPlaybackSession(lambda _:self.fail('MUST_NOT_LAUNCH'),
                               isolation_verified=True,heartbeat=lambda:False)
        self.assertTrue(s.start(event_id='event',file=self.file,repeats=1,authorized=True)['accepted'])
        s._thread.join(timeout=2)
        self.assertEqual(s.status()['state'],'STOPPED')

if __name__=='__main__':unittest.main()
