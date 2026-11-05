"""Narrow, supervised MCHS synthetic-WAV relay trial authorization.

Never uses Android danger events or general audio heartbeat as relay permission.
The server's existing amplifier-intent permit is always required. ESP32 signed
lease/watchdog is the final OFF bound if the Windows Agent crashes.
"""
import re

SYNTHETIC_EVENT = re.compile(r'synthetic_[a-f0-9]{24}_(?:danger|clear)\Z')


def decide_synthetic_relay_pilot(*, isolated, operator_armed, stop_requested,
                                 event_id, audio_mode, server_permit,
                                 now, armed_until, preparing=False):
    if not isolated or not operator_armed:
        return False, 'NOT_ARMED'
    if stop_requested:
        return False, 'AGENT_STOP'
    if not isinstance(armed_until,(int,float)) or now>=armed_until:
        return False, 'TRIAL_WINDOW_EXPIRED'
    if not server_permit:
        return False, 'SERVER_POWER_NOT_AUTHORIZED'
    if not (audio_mode=='MCHS_EVENT_ISOLATED_LOCAL_WAV' or
            (preparing and audio_mode in ('CENTRAL','LOCAL_RESERVE','STOPPED'))):
        return False, 'LOCAL_WAV_NOT_PLAYING'
    if not isinstance(event_id,str) or not SYNTHETIC_EVENT.fullmatch(event_id):
        return False, 'NOT_SYNTHETIC_EVENT'
    return True, 'SYNTHETIC_LOCAL_WAV_POWER_TRIAL'


def decide_isolated_manual_relay_test(*, isolated, operator_armed,
                                      manual_requested, server_permit,
                                      stop_requested, audio_event_active,
                                      now, requested_until, trial_until):
    """10-second operator test of GPIO13 with NO event WAV or PA broadcast."""
    if not isolated or not operator_armed or not manual_requested:
        return False, 'MANUAL_TEST_NOT_ARMED'
    if stop_requested or audio_event_active:
        return False, 'STOP_OR_AUDIO_EVENT'
    if not isinstance(requested_until,(int,float)) or now>=requested_until:
        return False, 'MANUAL_TEST_TIMEOUT'
    if not isinstance(trial_until,(int,float)) or now>=trial_until:
        return False, 'TRIAL_WINDOW_EXPIRED'
    if not server_permit:
        return False, 'SERVER_POWER_NOT_AUTHORIZED'
    return True, 'MANUAL_GPIO13_TEST'
