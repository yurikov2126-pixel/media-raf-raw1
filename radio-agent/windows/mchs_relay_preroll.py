"""Fail-closed 3-second ESP32 power pre-roll for synthetic MCHS training WAV.

A signed ON acknowledgement establishes a monotonic start; continuous renewal
is required so no WAV starts if the 8s lease risks expiring. An actual Android
alert never enters this gate; production PA requires separate implementation.
"""
import re

SYNTHETIC = re.compile(r'synthetic_[a-f0-9]{24}_(?:danger|clear)\Z')
PRE_ROLL_SECONDS = 3.0
TIMEOUT_SECONDS = 16.0
MAX_ACK_AGE_SECONDS = 4.0


def preroll_decision(*, event_id, requested_at, now, ack_event_id,
                     first_ack_at, last_ack_at, authorized=True,
                     stopped=False):
    if stopped or not authorized:
        return 'DENIED'
    if not isinstance(event_id,str) or not SYNTHETIC.fullmatch(event_id):
        return 'NOT_SYNTHETIC'
    if not isinstance(requested_at,(int,float)) or now<requested_at:
        return 'INVALID_REQUEST'
    if now-requested_at>=TIMEOUT_SECONDS:
        return 'TIMEOUT'
    if event_id!=ack_event_id or not isinstance(first_ack_at,(int,float)):
        return 'WAITING_POWER_ACK'
    if first_ack_at<requested_at or first_ack_at>now:
        return 'WAITING_POWER_ACK'
    if not isinstance(last_ack_at,(int,float)) or last_ack_at<first_ack_at:
        return 'WAITING_POWER_ACK'
    if now-last_ack_at>MAX_ACK_AGE_SECONDS:
        return 'STALE_POWER_ACK'
    if now-first_ack_at<PRE_ROLL_SECONDS:
        return 'WAITING_WARMUP'
    return 'READY'
