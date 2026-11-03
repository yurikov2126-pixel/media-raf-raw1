"""Narrow, supervised MCHS synthetic-WAV relay trial authorization.

Never uses Android danger events or general audio heartbeat as relay permission.
The server's existing amplifier-intent permit is always required. ESP32 signed
lease/watchdog is the final OFF bound if the Windows Agent crashes.
"""
import re

SYNTHETIC_EVENT = re.compile(r'synthetic_[a-f0-9]{24}_(?:danger|clear)\Z')


def decide_synthetic_relay_pilot(*, isolated, operator_armed, stop_requested,
                                 event_id, audio_mode, server_permit,
                                 now, armed_until):
    if not isolated or not operator_armed:
        return False, 'NOT_ARMED'
    if stop_requested:
        return False, 'AGENT_STOP'
    if not isinstance(armed_until,(int,float)) or now>=armed_until:
        return False, 'TRIAL_WINDOW_EXPIRED'
    if not server_permit:
        return False, 'SERVER_POWER_NOT_AUTHORIZED'
    if audio_mode!='MCHS_EVENT_ISOLATED_LOCAL_WAV':
        return False, 'LOCAL_WAV_NOT_PLAYING'
    if not isinstance(event_id,str) or not SYNTHETIC_EVENT.fullmatch(event_id):
        return False, 'NOT_SYNTHETIC_EVENT'
    return True, 'SYNTHETIC_LOCAL_WAV_POWER_TRIAL'
