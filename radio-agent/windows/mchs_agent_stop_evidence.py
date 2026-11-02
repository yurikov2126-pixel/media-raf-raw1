"""Conservative verification of isolated Windows VLC termination.

A closed relay or successful STOP request alone is never playback proof.
"""
def trial_stop_evidence(process, relay_closed):
    exited = process is not None and process.poll() is not None
    return {
        'processExited': bool(exited),
        'relayClosed': bool(relay_closed),
        'stopConfirmed': bool(exited and relay_closed),
        'paOutputVerified': False,
        'stationPlaybackStoppedVerified': False,
    }
