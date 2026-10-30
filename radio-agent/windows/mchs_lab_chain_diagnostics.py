"""Passive, non-certifying MCHS laboratory signal-chain diagnostics.

No PA, ESP32, relay, network command, or playback side effects.
"""
def assess_lab_chain(*, observer_fresh, worker_phase, authorized,
                     primary_alive, reserve_alive, output_state,
                     lab_connected, pcm_age_seconds, trial_active):
    checks = {
        'observer': 'OBSERVED' if observer_fresh else 'STALE',
        'worker': 'OBSERVED' if worker_phase in ('IDLE','PROGRAM','ALERT') else 'UNKNOWN',
        'authorization': 'OBSERVED' if authorized else 'STALE',
        'program_source': ('INTENTIONALLY_SUSPENDED' if trial_active else
                           'OBSERVED' if primary_alive or reserve_alive else 'MISSING'),
        'output_endpoint': 'OBSERVED' if output_state == 'AVAILABLE' else 'UNVERIFIED',
        'lab_pcm': ('NOT_TESTING' if not trial_active else
                    'UNCONNECTED' if not lab_connected else
                    'STALE' if pcm_age_seconds is None or pcm_age_seconds >= 5 else 'OBSERVED'),
    }
    return {
        'mode': 'DIAGNOSTIC_ONLY',
        'checks': checks,
        'labObservationComplete': all(checks[k] == 'OBSERVED' for k in
            ('observer','worker','authorization','output_endpoint'))
            and (checks['program_source'] == 'INTENTIONALLY_SUSPENDED' if trial_active
                 else checks['program_source'] == 'OBSERVED')
            and (not trial_active or checks['lab_pcm'] == 'OBSERVED'),
        'audibleOutputVerified': False,
        'physicalPAPathVerified': False,
        'realEmergencyReady': False,
    }
