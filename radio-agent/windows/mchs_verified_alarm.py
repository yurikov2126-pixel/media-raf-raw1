"""Validate a locally cached event-bound ALARM before any VLC handover.

The cache is deliberately read-only here. A matching hash is necessary but
not sufficient authorization to broadcast an emergency warning.
"""
import hashlib
import pathlib
import re

_ID = re.compile(r'[A-Za-z0-9_-]{1,128}\Z')
_SHA = re.compile(r'[a-f0-9]{64}\Z')

def verify_cached_alarm(command, cache_dir, *, max_bytes=50*1024*1024):
    if not isinstance(command, dict) or command.get('action') != 'START':
        return None, 'INVALID_START'
    event_id, asset_id = command.get('eventId'), command.get('assetId')
    digest = command.get('sha256')
    if not all(isinstance(x, str) and _ID.fullmatch(x) for x in (event_id, asset_id)):
        return None, 'INVALID_ASSET_ID'
    if not isinstance(digest, str) or not _SHA.fullmatch(digest):
        return None, 'INVALID_ASSET_DIGEST'
    if command.get('eventType') not in ('MISSILE_DANGER', 'MISSILE_ALL_CLEAR'):
        return None, 'INVALID_EVENT_TYPE'
    repeats = command.get('repeats')
    if type(repeats) is not int or not 1 <= repeats <= 5:
        return None, 'INVALID_REPEATS'
    if command['eventType'] == 'MISSILE_ALL_CLEAR' and repeats != 1:
        return None, 'INVALID_ALL_CLEAR_REPEATS'
    directory = pathlib.Path(cache_dir).resolve()
    # Never accept arbitrary paths or URLs from the incoming command.
    candidate = directory / (asset_id + '.alarm')
    try:
        file = candidate.resolve(strict=True)
        if file.parent != directory or not file.is_file():
            return None, 'ASSET_PATH_REJECTED'
        size = file.stat().st_size
        if not 0 < size <= max_bytes:
            return None, 'ASSET_SIZE_REJECTED'
        computed = hashlib.sha256()
        with file.open('rb') as handle:
            while block := handle.read(65536):
                computed.update(block)
        if not __import__('hmac').compare_digest(computed.hexdigest(), digest):
            return None, 'ASSET_DIGEST_MISMATCH'
        return file, None
    except (OSError, RuntimeError):
        return None, 'ASSET_UNAVAILABLE'
