"""Narrow, supervised MCHS synthetic-WAV relay trial authorization.

Never uses Android danger events or general audio heartbeat as relay permission.
The server's existing amplifier-intent permit is always required. ESP32 signed
lease/watchdog is the final OFF bound if the Windows Agent crashes.
"""
import re

SYNTHETIC_EVENT = re.compile(r'synthetic_[a-f0-9]{24}_(?:danger|clear)\Z')


def decide_synthetic_relay_pilot(*, isolated, operator_armed, stop_requested,
                                 event_id, audio_mode, server_permit,
                                 now, armed_until, preparing_event_id=None,
                                 manual_test_until=0):
    if not isolated or not operator_armed:
        return False, 'NOT_ARMED'
    if stop_requested:
        return False, 'AGENT_STOP'
    if not isinstance(armed_until,(int,float)) or now>=armed_until:
        return False, 'TRIAL_WINDOW_EXPIRED'
    if not server_permit:
        return False, 'SERVER_POWER_NOT_AUTHORIZED'
    if (isinstance(manual_test_until,(int,float)) and now<manual_test_until and
            event_id is None and preparing_event_id is None):
        return True, 'OPERATOR_MANUAL_RELAY_PULSE'
    if (isinstance(preparing_event_id,str) and
            SYNTHETIC_EVENT.fullmatch(preparing_event_id) and
            event_id == preparing_event_id):
        return True, 'SYNTHETIC_RELAY_PRE_ROLL'
    if audio_mode!='MCHS_EVENT_ISOLATED_LOCAL_WAV':
        return False, 'LOCAL_WAV_NOT_PLAYING'
    if not isinstance(event_id,str) or not SYNTHETIC_EVENT.fullmatch(event_id):
        return False, 'NOT_SYNTHETIC_EVENT'
    return True, 'SYNTHETIC_LOCAL_WAV_POWER_TRIAL'
