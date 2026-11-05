"""Non-actuating diagnostics for ESP32 relay transitions.

This module never grants power or suppresses an OFF command. It only makes
the difference between deliberate event-boundary OFF, server denial, expiry,
and transport failure observable to the operator.
"""
def describe_power_transition(*, previous, requested, server_permit,
                              reason, phase, event_id):
    if requested is None:
        return None
    if previous is requested:
        return None
    if requested:
        detail = 'ON_REQUESTED'
    elif server_permit is False:
        detail = 'OFF_SERVER_DENIED'
    elif reason == 'LOCAL_WAV_NOT_PLAYING':
        detail = 'OFF_AUDIO_BOUNDARY'
    elif reason == 'TRIAL_WINDOW_EXPIRED':
        detail = 'OFF_TRIAL_EXPIRED'
    elif reason == 'AGENT_STOP':
        detail = 'OFF_AGENT_STOP'
    else:
        detail = 'OFF_LOCAL_POLICY'
    return {'transition':detail,'phase':str(phase or 'UNKNOWN')[:64],
            'reason':str(reason or 'UNKNOWN')[:96],
            'event':str(event_id or 'NONE')[:128]}
