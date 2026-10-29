"""Pure read-only transition observer for an active Windows Radio Agent."""
class MchsTransitionShadow:
    def __init__(self):
        self.revision = None
        self.phase = None

    def observe(self, revision, phase):
        if not isinstance(revision, int) or isinstance(revision, bool) or revision < 0:
            return None
        if phase not in ('IDLE', 'PROGRAM', 'ALERT'):
            return None
        prior_revision, prior_phase = self.revision, self.phase
        if prior_revision is not None and revision <= prior_revision:
            return None
        self.revision, self.phase = revision, phase
        if prior_revision is None:
            state = 'BASELINE'
            missed = 0
        else:
            missed = max(0, revision-prior_revision-1)
            valid = ((prior_phase, phase) in (
                ('IDLE','PROGRAM'), ('PROGRAM','ALERT'),
                ('ALERT','PROGRAM'), ('PROGRAM','IDLE'), ('ALERT','IDLE')))
            state = 'MISSED_REVISIONS' if missed else 'EXPECTED' if valid else 'UNEXPECTED'
        return {'transitionState':state,'previousPhase':prior_phase,
                'currentPhase':phase,'missedRevisions':missed,
                'observedRevision':revision,'mode':'OBSERVE_ONLY'}
