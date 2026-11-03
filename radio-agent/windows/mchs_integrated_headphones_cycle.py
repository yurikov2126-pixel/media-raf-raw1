"""Finite-state local-only danger -> central -> clear -> central rehearsal.

No network, subprocess, dispatch, server, or PA side effects. The caller must
own its VLC processes and supply fresh central packet observations.
"""
class IntegratedHeadphonesCycle:
    def __init__(self, *, danger_repeats, danger_duration, clear_duration,
                 interlude_seconds=4):
        if type(danger_repeats) is not int or not 1<=danger_repeats<=5:
            raise ValueError('INVALID_DANGER_REPEATS')
        if not 0<danger_duration<=120 or not 0<clear_duration<=120:
            raise ValueError('INVALID_AUDIO_DURATION')
        self.repeats=danger_repeats
        self.durations={'DANGER':danger_duration,'ALL_CLEAR':clear_duration}
        self.phase='WAIT_BASELINE'
        self.stage=None
        self.deadline=None
        self.failure=None
        self.history=[]
        self.interlude_seconds=interlude_seconds
        self.wait_since=None

    @property
    def playing(self):
        return self.phase in ('PLAY_DANGER','PLAY_ALL_CLEAR')

    @property
    def terminal(self):
        return self.phase in ('DONE','FAILED')

    def started(self, stage, accepted, now):
        if self.phase!='START_'+stage:
            raise ValueError('UNEXPECTED_STAGE_START')
        if not accepted:
            self.failure=stage+'_START_DENIED'
            self.phase='FAILED'
            return
        self.stage=stage
        self.phase='PLAY_'+stage
        count=self.repeats if stage=='DANGER' else 1
        self.deadline=now+min(650,self.durations[stage]*count+25)

    def restored(self, *, now, monitor_armed):
        if self.phase not in ('RESTORE_DANGER','RESTORE_ALL_CLEAR','RESTORE_FAULT'):
            raise ValueError('UNEXPECTED_RETURN')
        if not monitor_armed:
            self.failure=self.failure or 'RETURN_MONITOR_UNAVAILABLE'
            self.phase='FAILED'
            return
        if self.phase=='RESTORE_FAULT':
            self.phase='AWAIT_RETURN_FAULT'
        elif self.phase=='RESTORE_DANGER':
            self.phase='AWAIT_RETURN_DANGER'
        else:
            self.phase='AWAIT_RETURN_ALL_CLEAR'
        self.deadline=now+32

    def tick(self, *, now, central_ready, authorized, conflicting=False,
             session=None, returned=None):
        if self.terminal:
            return None
        if self.phase=='WAIT_BASELINE':
            if self.wait_since is None:
                self.wait_since=now
            if conflicting or not authorized:
                if now-self.wait_since>90:
                    self.failure='BASELINE_NOT_READY'
                    self.phase='FAILED'
                return None
            if central_ready:
                self.phase='START_DANGER'
                return 'START_DANGER'
            if now-self.wait_since>90:
                self.failure='CENTRAL_BASELINE_TIMEOUT'
                self.phase='FAILED'
            return None
        if self.phase in ('START_DANGER','START_ALL_CLEAR'):
            return None
        if self.playing:
            count=self.repeats if self.stage=='DANGER' else 1
            natural=(isinstance(session,dict) and
                     session.get('state')=='COMPLETED' and
                     session.get('naturalCompletion') is True and
                     session.get('completedRepeats')==count and
                     session.get('expectedRepeats')==count and
                     session.get('processRunning') is False and
                     session.get('failureReason') is None)
            if natural:
                self.history.append({'stage':self.stage,'repeats':count,
                                     'natural':True})
                self.phase='RESTORE_'+self.stage
                return 'RESTORE_PROGRAM'
            if (not authorized or now>=self.deadline or
                    (session is not None and
                     (session.get('state')=='STOPPED' or
                      session.get('failureReason') is not None))):
                self.failure=self.stage+'_PLAYBACK_FAILED_OR_TIMEOUT'
                self.phase='RESTORE_FAULT'
                return 'RESTORE_FAULT'
            return None
        if self.phase.startswith('RESTORE_'):
            return None
        if self.phase.startswith('AWAIT_RETURN_'):
            if returned and returned.get('status')=='CONFIRMED':
                self.history.append({'returnedAfter':self.stage or 'FAULT',
                                     'centralPackets':True})
                if self.phase=='AWAIT_RETURN_DANGER':
                    self.phase='INTERLUDE'
                    self.deadline=now+self.interlude_seconds
                    return None
                self.phase='FAILED' if self.failure else 'DONE'
                return 'FINISHED' if not self.failure else 'FAULT_RETURNED'
            if (returned and returned.get('status')=='UNCONFIRMED') or now>=self.deadline:
                self.failure=self.failure or 'CENTRAL_RETURN_UNCONFIRMED'
                self.phase='FAILED'
            return None
        if self.phase=='INTERLUDE':
            if conflicting or not authorized:
                self.failure='INTERLUDE_INTERRUPTED'
                self.phase='FAILED'
            elif now>=self.deadline and central_ready:
                self.phase='START_ALL_CLEAR'
                return 'START_ALL_CLEAR'
            elif now-self.deadline>30:
                self.failure='CENTRAL_INTERLUDE_TIMEOUT'
                self.phase='FAILED'
            return None
        return None
