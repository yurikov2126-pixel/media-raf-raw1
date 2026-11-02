"""Reject a queued one-shot alarm after Worker state changes or observer becomes stale.
Pure decision; never starts audio or controls PA.
"""
def queued_auto_trial_current(observed, expected_revision, now, max_age=3.0):
    if not isinstance(observed, dict) or not isinstance(expected_revision, int) or isinstance(expected_revision, bool):
        return False
    at=observed.get('at')
    revision=observed.get('revision')
    return (observed.get('ready') is True and observed.get('phase')=='ALERT'
            and type(revision) is int and revision==expected_revision
            and isinstance(at,(int,float)) and not isinstance(at,bool)
            and 0<=now-at<=max_age)
