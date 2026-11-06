"""Fail-closed Windows radio amplifier interlock.

AUTO requires running, recently-audible playout and a fresh server permit.
A specifically authorized MANUAL power request is independent of playout state:
the operator may turn on an amplifier for setup without starting an audio stream.
Neither mode grants power without a current server authorization; relay lease
expiry remains the hardware fail-safe if the Agent stops renewing.
"""
def allowed_power(server_permit, broadcast_running, stop_requested,
                  stream_last_seen, now, audio_grace_seconds=30,
                  manual_override=False):
    # Server OFF (including emergency OFF, MANUAL OFF and revoked playback)
    # always wins, regardless of any local stop/audio-grace transitions.
    if not server_permit:
        return False, "SERVER_OR_NETWORK_OFF"
    if manual_override:
        # The caller MUST require a fresh explicitly MANUAL server intent,
        # a valid rr_ device, matching ESP32 IP and local hardware arming.
        return True, "SERVER_AUTHORIZED_MANUAL"
    if not broadcast_running or stop_requested:
        return False, "LOCAL_STOP"
    if stream_last_seen <= 0 or now-stream_last_seen >= audio_grace_seconds:
        return False, "AUDIO_TIMEOUT"
    return True, "AUTHORIZED_PLAYBACK"
