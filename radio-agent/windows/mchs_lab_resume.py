"""Decide when a locally authorized automatic MCHS lab trial must stop.

No network, PA or playback side effects. Non-ALERT states are fail-closed.
"""
def should_stop_auto_lab(transition, *, auto_active):
    if not auto_active or not isinstance(transition, dict):
        return False
    return (transition.get('previousPhase') == 'ALERT'
            and transition.get('currentPhase') in ('PROGRAM','IDLE')
            and transition.get('transitionState') in ('EXPECTED','MISSED_REVISIONS')
            and transition.get('mode') == 'OBSERVE_ONLY')
