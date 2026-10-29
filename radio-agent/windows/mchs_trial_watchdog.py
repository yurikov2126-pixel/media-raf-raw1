"""Pure, fail-closed decisions for a supervised local MCHS audio trial.

No PA control, process creation or network access.
"""
TRIAL_MAX_SECONDS = 30.0
CONNECT_GRACE_SECONDS = 8.0
PCM_STALE_SECONDS = 5.0


def trial_stop_reason(*, now, started_at, connected_at, last_pcm_at,
                      stop_requested, armed, authorized, vlc_running):
    if stop_requested or not armed:
        return 'OPERATOR_STOP'
    if not authorized:
        return 'AUTHORIZATION_LOST'
    if now - started_at >= TRIAL_MAX_SECONDS:
        return 'MAX_DURATION'
    if not vlc_running:
        return 'VLC_EXITED'
    if connected_at is None:
        if now - started_at >= CONNECT_GRACE_SECONDS:
            return 'PCM_CONNECT_TIMEOUT'
    elif last_pcm_at is None or now - last_pcm_at >= PCM_STALE_SECONDS:
        return 'PCM_STALLED'
    return None
