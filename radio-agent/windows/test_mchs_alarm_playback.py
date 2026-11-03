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
    def test_natural_completion_requires_no_manual_stop(self):
        calls=[]
        session=AlarmPlaybackSession(lambda file:(calls.append(file),FakeProcess())[1],
                                     isolation_verified=True,sleep=lambda _:None)
        self.assertTrue(session.start(event_id='danger',file=self.file,
                                      repeats=5,authorized=True)['accepted'])
        session._thread.join(timeout=2)
        self.assertEqual(session.status()['state'],'COMPLETED')
        self.assertEqual(session.status()['completedRepeats'],5)
        self.assertIsNone(session.status()['failureReason'])
        self.assertEqual(len(calls),5)
        self.assertTrue(session.start(event_id='clear',file=self.file,
                                      repeats=1,authorized=True)['accepted'])
        session._thread.join(timeout=2)
        self.assertEqual(session.status()['state'],'COMPLETED')
        self.assertEqual(session.status()['completedRepeats'],1)

    def test_player_failure_never_claims_natural_completion(self):
        session=AlarmPlaybackSession(lambda _:FakeProcess(code=1),
                                     isolation_verified=True,sleep=lambda _:None)
        self.assertTrue(session.start(event_id='failed',file=self.file,
                                      repeats=3,authorized=True)['accepted'])
        session._thread.join(timeout=2)
        self.assertEqual(session.status()['state'],'STOPPED')
        self.assertEqual(session.status()['completedRepeats'],0)
        self.assertEqual(session.status()['failureReason'],'RuntimeError')

    def test_watchdog_aborts_before_launch(self):
        s=AlarmPlaybackSession(lambda _:self.fail('MUST_NOT_LAUNCH'),
                               isolation_verified=True,heartbeat=lambda:False)
        self.assertTrue(s.start(event_id='event',file=self.file,repeats=1,authorized=True)['accepted'])
        s._thread.join(timeout=2)
        self.assertEqual(s.status()['state'],'STOPPED')

    def test_stop_during_slow_launch_does_not_report_completed(self):
        launching=threading.Event()
        proceed=threading.Event()
        processes=[]
        def slow_launch(_):
            launching.set()
            self.assertTrue(proceed.wait(timeout=2))
            proc=FakeProcess()
            proc.poll=lambda:proc.returncode
            processes.append(proc)
            return proc
        session=AlarmPlaybackSession(slow_launch,isolation_verified=True)
        self.assertTrue(session.start(event_id='race',file=self.file,repeats=1,authorized=True)['accepted'])
        self.assertTrue(launching.wait(timeout=2))
        stopper=threading.Thread(target=session.stop)
        stopper.start()
        proceed.set()
        stopper.join(timeout=5)
        session._thread.join(timeout=2)
        self.assertEqual(session.status()['state'],'STOPPED')
        self.assertEqual(session.status()['completedRepeats'],0)
        self.assertIsNotNone(processes[0].returncode)

    def test_completed_event_cannot_replay_after_poll_retry(self):
        session=AlarmPlaybackSession(lambda _:FakeProcess(),isolation_verified=True,
                                     sleep=lambda _:None)
        self.assertTrue(session.start(event_id='same',file=self.file,
                                      repeats=1,authorized=True)['accepted'])
        session._thread.join(timeout=2)
        self.assertEqual(session.status()['state'],'COMPLETED')
        self.assertEqual(session.start(event_id='same',file=self.file,
                                       repeats=1,authorized=True)['reason'],'REPLAYED_EVENT')
        self.assertTrue(session.start(event_id='next',file=self.file,
                                      repeats=1,authorized=True)['accepted'])
        session._thread.join(timeout=2)
        self.assertEqual(session.status()['state'],'COMPLETED')
    def test_stop_reports_confirmed_exit(self):
        session=AlarmPlaybackSession(lambda _:FakeProcess(),isolation_verified=True,
                                     sleep=lambda _:None)
        self.assertTrue(session.start(event_id='stop1',file=self.file,
                                      repeats=1,authorized=True)['accepted'])
        result=session.stop()
        self.assertTrue(result['stopConfirmed'])
        self.assertIn(result['state'],('STOPPED','COMPLETED'))


    def test_natural_completion_report_is_event_scoped(self):
        session=AlarmPlaybackSession(lambda _:FakeProcess(),isolation_verified=True,
                                     sleep=lambda _:None)
        self.assertTrue(session.start(event_id='danger',file=self.file,
                                      repeats=5,authorized=True)['accepted'])
        session._thread.join(timeout=2)
        state=session.status()
        self.assertEqual(state['eventId'],'danger')
        self.assertEqual(state['state'],'COMPLETED')
        self.assertEqual(state['expectedRepeats'],5)
        self.assertEqual(state['completedRepeats'],5)
        self.assertTrue(state['naturalCompletion'])
        self.assertFalse(state['processRunning'])
        self.assertIsNone(state['failureReason'])

    def test_failed_process_does_not_claim_natural_completion(self):
        session=AlarmPlaybackSession(lambda _:FakeProcess(code=2),
                                     isolation_verified=True,sleep=lambda _:None)
        self.assertTrue(session.start(event_id='broken',file=self.file,
                                      repeats=3,authorized=True)['accepted'])
        session._thread.join(timeout=2)
        state=session.status()
        self.assertEqual(state['state'],'STOPPED')
        self.assertFalse(state['naturalCompletion'])
        self.assertEqual(state['expectedRepeats'],3)
        self.assertEqual(state['completedRepeats'],0)
        self.assertEqual(state['failureReason'],'RuntimeError')

    def test_prior_event_cannot_replay_after_different_event(self):
        session=AlarmPlaybackSession(lambda _:FakeProcess(),isolation_verified=True,
                                     sleep=lambda _:None)
        for event_id in ('danger','clear'):
            self.assertTrue(session.start(event_id=event_id,file=self.file,
                                          repeats=1,authorized=True)['accepted'])
            session._thread.join(timeout=2)
        self.assertEqual(session.start(event_id='danger',file=self.file,
                                       repeats=1,authorized=True)['reason'],'REPLAYED_EVENT')

    def test_denied_start_is_not_added_to_event_history(self):
        session=AlarmPlaybackSession(lambda _:FakeProcess(),isolation_verified=True,
                                     sleep=lambda _:None)
        self.assertEqual(session.start(event_id='event',file=self.file,
                                       repeats=1,authorized=False)['reason'],
                         'ISOLATION_OR_AUTHORIZATION_MISSING')
        self.assertTrue(session.start(event_id='event',file=self.file,
                                      repeats=1,authorized=True)['accepted'])
        session._thread.join(timeout=2)

    def test_event_history_is_bounded(self):
        session=AlarmPlaybackSession(lambda _:FakeProcess(),isolation_verified=True,
                                     sleep=lambda _:None)
        for number in range(251):
            self.assertTrue(session.start(event_id=f'event-{number}',file=self.file,
                                          repeats=1,authorized=True)['accepted'])
            session._thread.join(timeout=2)
        self.assertEqual(len(session._recent_event_ids),250)
        self.assertEqual(len(session._recent_event_set),250)
        self.assertEqual(session.start(event_id='event-1',file=self.file,
                                       repeats=1,authorized=True)['reason'],'REPLAYED_EVENT')

if __name__=='__main__':unittest.main()
