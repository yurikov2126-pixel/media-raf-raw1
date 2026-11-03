"""Fail-closed MCHS event command validation for Windows Radio Agent.

START admission is not permission to play audio: the caller must separately
verify the event-bound signed/authorized asset and physical output.
"""
import datetime
import re

def validate_command(command, *, last_sequence=0, halted=True, now=None):
    if not isinstance(command, dict) or command.get('version') != 1:
        return False, 'INVALID_VERSION'
    action = command.get('action')
    seq = command.get('sequence')
    if action not in ('START', 'STOP') or type(seq) is not int or seq <= last_sequence:
        return False, 'INVALID_OR_REPLAYED_COMMAND'
    if not isinstance(command.get('eventId'), str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', command['eventId']):
        return False, 'INVALID_EVENT_ID'
    if command.get('eventType') not in ('MISSILE_DANGER', 'MISSILE_ALL_CLEAR'):
        return False, 'INVALID_EVENT_TYPE'
    now = now or datetime.datetime.now(datetime.timezone.utc)
    try:
        created = datetime.datetime.fromisoformat(command['createdAt'].replace('Z', '+00:00'))
        expires = datetime.datetime.fromisoformat(command['expiresAt'].replace('Z', '+00:00'))
        if not (created.tzinfo and expires.tzinfo and
                created <= now + datetime.timedelta(seconds=5) and
                now < expires <= created + datetime.timedelta(seconds=30)):
            return False, 'COMMAND_EXPIRED'
    except (KeyError, TypeError, ValueError, AttributeError):
        return False, 'INVALID_COMMAND_TIME'
    if action == 'START':
        if halted:
            return False, 'HALT_ACTIVE'
        # A bridge-observed event may run *only* in the explicitly isolated
        # headphones trial. This is not official provenance or PA permission.
        trial_source=(command.get('trialOnly') is True and
                      command.get('trialSourceAccepted') is True and
                      command.get('officialSourceVerified') is False)
        if command.get('officialSourceVerified') is not True and not trial_source:
            return False, 'SOURCE_NOT_VERIFIED'
        if not isinstance(command.get('assetId'), str) or not command['assetId']:
            return False, 'MISSING_AUDIO_ASSET'
        repeats = command.get('repeats')
        if type(repeats) is not int or not 1 <= repeats <= 5:
            return False, 'INVALID_REPEATS'
        if command['eventType'] == 'MISSILE_ALL_CLEAR' and repeats != 1:
            return False, 'INVALID_ALL_CLEAR_REPEATS'
    return True, None
