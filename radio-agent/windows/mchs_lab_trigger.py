"""One-shot, locally armed MCHS laboratory trigger policy.

No network access, audio playback or physical hardware control.
"""
def next_lab_trigger(transition, *, armed, expires_at, now):
    if not armed or now >= expires_at or not isinstance(transition, dict):
        return False
    return (transition.get('transitionState') == 'EXPECTED'
            and transition.get('previousPhase') == 'PROGRAM'
            and transition.get('currentPhase') == 'ALERT'
            and transition.get('missedRevisions') == 0
            and transition.get('mode') == 'OBSERVE_ONLY')
