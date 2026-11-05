"""Event-bound *isolated headphones* MCHS audio controller.

All actions are commands to the caller. This module never operates VLC,
public radio, Android, Worker, amplifier, or ESP32. It requires a locally
verified audio map and a durable EventAdmissionLedger.
"""
import hmac

class IsolatedEventAudioController:
    def __init__(self, ledger, assets):
        self.ledger=ledger
        self.assets=assets  # eventType -> {'path','sha256','duration'}
        self.state='IDLE'
        self.event=None
        self.event_type=None
        self.repeats=0
        self.deadline=None
        self.failure=None
        self.last_receipt=None
        self.stop_requested=False
        self.history=[]

    @property
    def playing(self):
        return self.state=='PLAYING'

    @property
    def restoring(self):
        return self.state=='RESTORING'

    @property
    def busy(self):
        return self.playing or self.restoring or self.state=='STARTING'

    def command(self, state, *, now, baseline, authorized):
        """Validate a server envelope and optionally request local VLC action.

        STOP/HALT are prioritized over START. A server command is not enough:
        strict local isolate consent, preverified file digest and central
        baseline are checked before the persistent admission transaction.
        """
        if not isinstance(state,dict) or state.get('version')!=1:
            return ('REJECTED','INVALID_PROTOCOL')
        command=state.get('command')
        # STOP is processed even if the server simultaneously enters HALT,
        # preserving the event-bound command audit and replay fence.
        if isinstance(command,dict) and command.get('action')=='STOP':
            action='STOP'
        elif state.get('halted') is True:
            if self.state=='STARTING':
                self.failure='SERVER_HALT_DURING_PRE_ROLL'
                self.state='FAILED'
                return ('NO_ACTION','SERVER_HALT_DURING_PRE_ROLL')
            if self.playing:
                self.failure='SERVER_HALT'
                self.stop_requested=True
                return ('STOP_AUDIO','SERVER_HALT')
            return ('NO_ACTION','HALTED')
        elif not isinstance(command,dict):
            return ('NO_ACTION','NO_COMMAND')
        else:
            action=command.get('action')
        if action=='STOP':
            # A STOP for an unrelated event must not hijack the active WAV.
            if self.busy and command.get('eventId')!=self.event:
                return ('REJECTED','STOP_EVENT_MISMATCH')
            receipt=self.ledger.observe(command,halted=True,
                                        physical_isolation=True,
                                        execution_enabled=False)
            if not receipt['accepted']:
                return ('REJECTED',receipt['reason'])
            self.last_receipt=receipt
            if self.state=='STARTING':
                self.failure='SERVER_STOP_DURING_PRE_ROLL'
                self.state='FAILED'
                return ('STOP_ACCEPTED','PRE_ROLL_CANCELLED')
            if self.playing:
                self.failure='SERVER_STOP'
                self.stop_requested=True
                return ('STOP_AUDIO','SERVER_STOP')
            return ('STOP_ACCEPTED','NO_AUDIO_RUNNING')
        if action!='START':
            return ('REJECTED','UNKNOWN_ACTION')
        if state.get('executionEnabled') is not True:
            return ('REJECTED','EXECUTION_DISABLED')
        if self.busy:
            # Delivery is at-least-once until the server receives a terminal
            # observation. An exact replay of the active START is a harmless
            # acknowledgement, not a second request to launch VLC.
            if (command.get('eventId')==self.event and
                    isinstance(self.last_receipt,dict) and
                    command.get('sequence')==self.last_receipt.get('sequence') and
                    command.get('eventType')==self.event_type and
                    command.get('repeats')==self.repeats and
                    command.get('sha256')==self.assets.get(self.event_type,{}).get('sha256') and
                    command.get('action')=='START'):
                return ('NO_ACTION','ACTIVE_EVENT_ALREADY_RUNNING')
            return ('REJECTED','EVENT_AUDIO_BUSY')
        if not authorized or not baseline:
            return ('REJECTED','CENTRAL_BASELINE_REQUIRED')
        kind=command.get('eventType')
        asset=self.assets.get(kind)
        if asset is None or not isinstance(command.get('sha256'),str):
            return ('REJECTED','LOCAL_ASSET_UNAVAILABLE')
        if not hmac.compare_digest(command['sha256'].lower(),asset['sha256'].lower()):
            return ('REJECTED','EVENT_ASSET_DIGEST_MISMATCH')
        receipt=self.ledger.observe(command,halted=False,
                                    physical_isolation=True,
                                    execution_enabled=True)
        if not receipt['accepted']:
            return ('REJECTED',receipt['reason'])
        self.last_receipt=receipt
        self.event=command['eventId']
        self.event_type=kind
        self.repeats=command['repeats']
        self.deadline=None
        self.failure=None
        self.stop_requested=False
        self.state='STARTING'
        return ('START_AUDIO',{'eventId':self.event,'asset':asset['path'],
                               'sha256':asset['sha256'],
                               'repeats':self.repeats,'eventType':kind})

    def started(self,accepted,*,now,duration,failure_reason='VLC_START_REJECTED'):
        if self.state!='STARTING':
            raise RuntimeError('UNEXPECTED_START_RESULT')
        if not accepted:
            self.failure=failure_reason
            self.state='FAILED'
            return
        self.state='PLAYING'
        self.deadline=now+min(650,duration*self.repeats+25)

    def tick(self, *, now,authorized,session=None,return_result=None):
        if self.state=='PLAYING':
            natural=(isinstance(session,dict) and
                     session.get('eventId')==self.event and
                     session.get('state')=='COMPLETED' and
                     session.get('naturalCompletion') is True and
                     session.get('completedRepeats')==self.repeats and
                     session.get('expectedRepeats')==self.repeats and
                     session.get('processRunning') is False and
                     session.get('failureReason') is None)
            if natural:
                self.history.append({'eventId':self.event,'naturalCompletion':True,
                                     'repeats':self.repeats})
                self.state='RESTORING'
                return 'RESTORE'
            if (self.stop_requested or not authorized or now>=self.deadline or
                    (session is not None and
                     (session.get('state')=='STOPPED' or
                      session.get('failureReason') is not None))):
                self.failure=self.failure or 'AUDIO_INTERRUPTED_OR_TIMEOUT'
                self.state='RESTORING'
                return 'STOP_AND_RESTORE'
        elif self.state=='RESTORING':
            if return_result and return_result.get('status')=='CONFIRMED':
                self.history.append({'eventId':self.event,'centralReturned':True})
                self.state='FAILED' if self.failure else 'COMPLETE'
                return 'RETURN_CONFIRMED'
            if (return_result and return_result.get('status')=='UNCONFIRMED') or (
                    self.deadline is not None and now>=self.deadline):
                self.failure=self.failure or 'CENTRAL_RETURN_UNCONFIRMED'
                self.state='FAILED'
                return 'RETURN_FAILED'
        return None

    def restore_armed(self,*,now,confirmed):
        if self.state!='RESTORING':
            raise RuntimeError('UNEXPECTED_RESTORE_ARM')
        if not confirmed:
            # Unconfirmed process exit is the primary safety failure even
            # when an earlier timeout/STOP triggered the recovery.
            self.failure='LOCAL_AUDIO_STOP_UNCONFIRMED'
            self.state='FAILED'
            return
        self.deadline=now+32

    def snapshot(self):
        return {'eventId':self.event,'state':self.state,'repeats':self.repeats,
                'failure':self.failure,'history':list(self.history),
                'physicalPAConfirmed':False,'publicPlaybackAuthorized':False}
