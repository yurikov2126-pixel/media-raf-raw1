"""Passive MCHS readiness classification. Never controls playback or hardware."""
def assess_mchs_readiness(*, primary_alive, reserve_alive, last_packet_age_ms,
                          output_state, authorized, worker_phase):
    if not authorized:
        code = 'AUTHORIZATION_STALE'
    elif not primary_alive and not reserve_alive:
        code = 'NO_LOCAL_PLAYBACK'
    elif primary_alive and (last_packet_age_ms is None or last_packet_age_ms > 4000):
        code = 'PRIMARY_AUDIO_STALE'
    elif output_state != 'AVAILABLE':
        code = 'OUTPUT_UNVERIFIED'
    else:
        code = 'OBSERVABLE_ONLY'
    return {
        'mode': 'OBSERVE_ONLY',
        'code': code,
        'workerPhase': worker_phase if worker_phase in ('IDLE','PROGRAM','ALERT') else 'UNKNOWN',
        'primaryAlive': bool(primary_alive),
        'reserveAlive': bool(reserve_alive),
        'outputProbe': output_state if output_state in ('AVAILABLE','UNAVAILABLE','UNKNOWN','UNSUPPORTED') else 'UNKNOWN',
        'audioInterruptionVerified': False,
        'paOutputVerified': False,
        'physicalPriorityVerified': False,
    }
