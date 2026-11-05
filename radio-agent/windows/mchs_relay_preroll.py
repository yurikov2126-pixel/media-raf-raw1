"""Physical amplifier warmup gate for an admitted synthetic MCHS event.

A signed ESP32 ON command is not actual voltage feedback. This waits at least
3 seconds after the acknowledged ON lease, while requiring a recent renewal
and matching event ID. Failure never permits an early local WAV.
"""
import math
import re

SYNTHETIC_ID = re.compile(r'synthetic_[a-f0-9]{24}_(danger|clear)\Z')
WARMUP_SECONDS = 3.0
RENEWAL_MAX_AGE = 6.0
PREFLIGHT_TIMEOUT = 20.0


def gate_synthetic_wav(*, event_id, relay_event_id, relay_on_at,
                       last_lease_at, now, requested_at, stop=False,
                       server_ok=True, warmup_seconds=WARMUP_SECONDS):
    if stop or not server_ok:
        return 'ABORT', 'HALT_OR_AUTHORIZATION_LOST'
    if not isinstance(event_id,str) or not SYNTHETIC_ID.fullmatch(event_id):
        return 'ABORT', 'NOT_SYNTHETIC_EVENT'
    if not all(isinstance(x,(int,float)) and math.isfinite(x)
               for x in (now,requested_at)):
        return 'ABORT', 'INVALID_TIME'
    if now-requested_at>=PREFLIGHT_TIMEOUT:
        return 'ABORT', 'AMPLIFIER_WARMUP_TIMEOUT'
    if relay_event_id!=event_id:
        return 'WAIT', 'RELAY_EVENT_NOT_ACKNOWLEDGED'
    if not all(isinstance(x,(int,float)) and math.isfinite(x)
               for x in (relay_on_at,last_lease_at)):
        return 'WAIT', 'RELAY_POWER_NOT_ACKNOWLEDGED'
    if relay_on_at<requested_at or last_lease_at<relay_on_at:
        return 'WAIT', 'OLD_RELAY_ACK'
    if now-last_lease_at>RENEWAL_MAX_AGE:
        return 'WAIT', 'RELAY_LEASE_NOT_FRESH'
    if now-relay_on_at<warmup_seconds:
        return 'WAIT', 'AMPLIFIER_WARMING_UP'
    return 'START', 'AMPLIFIER_WARMUP_COMPLETE'
