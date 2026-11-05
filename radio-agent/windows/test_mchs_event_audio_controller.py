import datetime
import hashlib
import tempfile
import unittest
from pathlib import Path
from mchs_event_admission import EventAdmissionLedger
from mchs_event_audio_controller import IsolatedEventAudioController

NOW=datetime.datetime.now(datetime.timezone.utc)


def event(seq,kind='MISSILE_DANGER',action='START',event_id='danger-1',
          digest='a'*64,repeats=4):
    return {'version':1,'action':action,'sequence':seq,'eventId':event_id,
            'eventType':kind,'assetId':'local-training',
            'sha256':digest,'officialSourceVerified':True,'repeats':repeats,
            'createdAt':(NOW-datetime.timedelta(seconds=2)).isoformat(),
            'expiresAt':(NOW+datetime.timedelta(seconds=20)).isoformat()}


def envelope(command,halted=False,enabled=True):
    return {'version':1,'command':command,'halted':halted,
            'executionEnabled':enabled}


def session(event_id,repeats,*,natural=True):
    return {'eventId':event_id,'state':'COMPLETED' if natural else 'PLAYING',
            'completedRepeats':repeats,'expectedRepeats':repeats,
            'naturalCompletion':natural,'processRunning':not natural,
            'failureReason':None}


class EventBoundAudioTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.ledger=EventAdmissionLedger(Path(self.temp.name)/'ledger.json')
        self.ctrl=IsolatedEventAudioController(self.ledger,{
            'MISSILE_DANGER':{'path':Path(self.temp.name)/'danger.wav',
                             'sha256':'a'*64,'duration':3},
            'MISSILE_ALL_CLEAR':{'path':Path(self.temp.name)/'clear.wav',
                                'sha256':'b'*64,'duration':3}})

    def send(self,command,**kwargs):
        args={'now':1,'baseline':True,'authorized':True}
        args.update(kwargs)
        return self.ctrl.command(envelope(command),**args)

    def test_full_event_bound_danger_and_clear_with_independent_returns(self):
        decision,data=self.send(event(1))
        self.assertEqual(decision,'START_AUDIO')
        self.assertEqual(data['repeats'],4)
        self.ctrl.started(True,now=1,duration=3)
        self.assertIsNone(self.ctrl.tick(now=2,authorized=True,session=session('danger-1',3, natural=False)))
        self.assertEqual(self.ctrl.tick(now=14,authorized=True,session=session('danger-1',4)),'RESTORE')
        self.ctrl.restore_armed(now=14,confirmed=True)
        self.assertIsNone(self.ctrl.tick(now=15,authorized=True,return_result={'status':'PENDING'}))
        self.assertEqual(self.ctrl.tick(now=18,authorized=True,return_result={'status':'CONFIRMED'}),
                         'RETURN_CONFIRMED')
        self.assertEqual(self.ctrl.snapshot()['state'],'COMPLETE')
        decision,data=self.send(event(2,'MISSILE_ALL_CLEAR',
                                        event_id='clear-1',digest='b'*64,repeats=1))
        self.assertEqual(decision,'START_AUDIO')
        self.ctrl.started(True,now=20,duration=3)
        self.assertEqual(self.ctrl.tick(now=23,authorized=True,
                             session=session('clear-1',1)),'RESTORE')
        self.ctrl.restore_armed(now=23,confirmed=True)
        self.assertEqual(self.ctrl.tick(now=25,authorized=True,
                             return_result={'status':'CONFIRMED'}),'RETURN_CONFIRMED')
        self.assertEqual(len(self.ctrl.history),4)
        self.assertFalse(self.ctrl.snapshot()['physicalPAConfirmed'])

    def test_unverified_or_mismatched_assets_never_start_audio(self):
        self.assertEqual(self.send(event(1,digest='0'*64))[0],'REJECTED')
        self.assertEqual(self.ledger.data['lastSequence'],0)
        c=event(1)
        c['officialSourceVerified']=False
        self.assertEqual(self.send(c)[1],'SOURCE_NOT_VERIFIED')
        self.assertEqual(self.send(event(1),authorized=False)[1],'CENTRAL_BASELINE_REQUIRED')
        self.assertEqual(self.send(event(1),baseline=False)[1],'CENTRAL_BASELINE_REQUIRED')

    def test_exact_redelivery_during_wav_is_idempotent(self):
        command=event(1)
        self.assertEqual(self.send(command)[0],'START_AUDIO')
        self.ctrl.started(True,now=1,duration=3)
        decision,reason=self.send(command)
        self.assertEqual((decision,reason),
                         ('NO_ACTION','ACTIVE_EVENT_ALREADY_RUNNING'))
        self.assertEqual(self.ctrl.state,'PLAYING')
        self.assertEqual(self.ledger.data['lastSequence'],1)
        self.assertEqual(len(self.ledger.data['seen']),1)

    def test_unrelated_or_changed_start_during_wav_still_rejected(self):
        command=event(1)
        self.send(command)
        self.ctrl.started(True,now=1,duration=3)
        for changed in (
                event(2,event_id='other-danger'),
                event(2),
                event(1,digest='b'*64),
                event(1,repeats=2)):
            self.assertEqual(self.send(changed),
                             ('REJECTED','EVENT_AUDIO_BUSY'))
        self.assertEqual(self.ledger.data['lastSequence'],1)

    def test_replayed_start_rejected_after_restart(self):
        self.assertEqual(self.send(event(1))[0],'START_AUDIO')
        second=IsolatedEventAudioController(EventAdmissionLedger(self.ledger.path),
                                           self.ctrl.assets)
        self.assertEqual(second.command(envelope(event(2)),now=1,baseline=True,
                                             authorized=True)[1],'REPLAYED_EVENT')

    def test_stop_or_halt_cancels_pre_roll_before_vlc(self):
        self.assertEqual(self.send(event(1))[0],'START_AUDIO')
        self.assertEqual(self.ctrl.state,'STARTING')
        result=self.send(event(2,action='STOP'))
        self.assertEqual(result,('STOP_ACCEPTED','PRE_ROLL_CANCELLED'))
        self.assertEqual(self.ctrl.state,'FAILED')
        self.assertEqual(self.ctrl.failure,'SERVER_STOP_DURING_PRE_ROLL')
        self.ctrl=IsolatedEventAudioController(EventAdmissionLedger(
            Path(self.temp.name)/'halt-ledger.json'),self.ctrl.assets)
        self.assertEqual(self.send(event(1))[0],'START_AUDIO')
        result=self.ctrl.command(envelope(None,halted=True,enabled=False),
                                 now=2,baseline=False,authorized=False)
        self.assertEqual(result,('NO_ACTION','SERVER_HALT_DURING_PRE_ROLL'))
        self.assertEqual(self.ctrl.state,'FAILED')

    def test_failed_power_pre_roll_never_reports_completed_wav(self):
        self.assertEqual(self.send(event(1))[0],'START_AUDIO')
        self.ctrl.started(False,now=17,duration=0,
                          failure_reason='RELAY_PREROLL_TIMEOUT')
        self.assertEqual(self.ctrl.state,'FAILED')
        self.assertEqual(self.ctrl.snapshot()['failure'],'RELAY_PREROLL_TIMEOUT')
        self.assertEqual(self.ctrl.history,[])

    def test_stop_during_audio_interrupts_then_waits_for_return(self):
        self.send(event(1));self.ctrl.started(True,now=1,duration=3)
        result=self.send(event(2,action='STOP'))
        self.assertEqual(result[0],'STOP_AUDIO')
        self.assertEqual(self.ctrl.tick(now=4,authorized=True),'STOP_AND_RESTORE')
        self.ctrl.restore_armed(now=4,confirmed=True)
        self.assertEqual(self.ctrl.tick(now=6,authorized=True,
                     return_result={'status':'CONFIRMED'}),'RETURN_CONFIRMED')
        self.assertEqual(self.ctrl.state,'FAILED')
        self.assertEqual(self.ctrl.failure,'SERVER_STOP')

    def test_halt_preempts_playing_audio(self):
        self.send(event(1));self.ctrl.started(True,now=1,duration=3)
        action,_=self.ctrl.command(envelope(None,halted=True,enabled=False),
                                     now=5,baseline=False,authorized=False)
        self.assertEqual(action,'STOP_AUDIO')
        self.assertEqual(self.ctrl.tick(now=5,authorized=False),'STOP_AND_RESTORE')

    def test_unrelated_stop_cannot_cancel_event(self):
        self.send(event(1));self.ctrl.started(True,now=1,duration=3)
        self.assertEqual(self.send(event(2,action='STOP',event_id='other'))[1],
                         'STOP_EVENT_MISMATCH')
        self.assertEqual(self.ctrl.state,'PLAYING')

    def test_expired_command_and_clear_before_danger_denied(self):
        self.assertEqual(self.send(event(1,'MISSILE_ALL_CLEAR',
                  event_id='clear-1',digest='b'*64,repeats=1))[1],'DANGER_EVENT_REQUIRED')
        c=event(1)
        c['expiresAt']=(NOW-datetime.timedelta(seconds=1)).isoformat()
        self.assertEqual(self.send(c)[1],'COMMAND_EXPIRED')

    def test_watchdog_stop_without_fresh_packets_fails(self):
        self.send(event(1));self.ctrl.started(True,now=1,duration=3)
        self.assertEqual(self.ctrl.tick(now=40,authorized=False),'STOP_AND_RESTORE')
        self.ctrl.restore_armed(now=40,confirmed=True)
        self.assertEqual(self.ctrl.tick(now=45,authorized=True,
                         return_result={'status':'UNCONFIRMED'}),'RETURN_FAILED')
        self.assertEqual(self.ctrl.state,'FAILED')

    def test_unconfirmed_vlc_exit_blocks_return(self):
        self.send(event(1));self.ctrl.started(True,now=1,duration=3)
        self.ctrl.tick(now=40,authorized=False)
        self.ctrl.restore_armed(now=40,confirmed=False)
        self.assertEqual(self.ctrl.failure,'LOCAL_AUDIO_STOP_UNCONFIRMED')
        self.assertEqual(self.ctrl.state,'FAILED')

    def test_protocol_and_disabled_execution_are_rejected(self):
        self.assertEqual(self.ctrl.command({'version':2},now=1,baseline=True,
                                           authorized=True)[1],'INVALID_PROTOCOL')
        self.assertEqual(self.ctrl.command(envelope(event(1),enabled=False),now=1,
                                baseline=True,authorized=True)[1],'EXECUTION_DISABLED')


if __name__=='__main__':
    unittest.main()
