"""Fail-closed Windows radio amplifier interlock.

A short gap between playout processes does not interrupt an already authorized
broadcast, but this helper never grants power without server authorization.
"""
def allowed_power(server_permit, broadcast_running, stop_requested,
                  stream_last_seen, now, audio_grace_seconds=30):
    if not broadcast_running or stop_requested:
        return False, "LOCAL_STOP"
    if stream_last_seen <= 0 or now-stream_last_seen >= audio_grace_seconds:
        return False, "AUDIO_TIMEOUT"
    if not server_permit:
        return False, "SERVER_OR_NETWORK_OFF"
    return True, "AUTHORIZED_PLAYBACK"
