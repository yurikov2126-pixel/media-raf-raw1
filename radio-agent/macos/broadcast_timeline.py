"""Deterministic broadcast timeline shared by future server-stream and local fallback.

All timestamps are UTC seconds. Never restart a slot from zero on takeover.
"""
from datetime import datetime

def timestamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()

def locate_track(slot, now):
    start=timestamp(slot['startAt'])
    end=timestamp(slot['endAt'])
    if not start <= now < end:
        return None
    elapsed_ms=int((now-start)*1000)
    for index,track in enumerate(slot['tracks']):
        duration=int(track['durationMs'])
        if duration<=0:
            continue
        if elapsed_ms < duration:
            return {'index':index,'track':track,'offset_ms':elapsed_ms,'slot_id':slot['id']}
        elapsed_ms-=duration
    return None

def current_track(slots, now):
    for slot in sorted(slots,key=lambda item:item['startAt']):
        found=locate_track(slot,now)
        if found:
            return found
    return None

def stream_windows(slots, prewarm_seconds=60, keepalive_gap_seconds=600):
    """Merge adjoining scheduled slots; stream starts prewarm_seconds early.

    Gap >= 10 minutes closes the transport (user requirement).
    """
    windows=[]
    for slot in sorted(slots,key=lambda item:item['startAt']):
        start=timestamp(slot['startAt'])
        end=timestamp(slot['endAt'])
        if end<=start:
            continue
        if windows and start-windows[-1]['end'] < keepalive_gap_seconds:
            windows[-1]['end']=max(windows[-1]['end'],end)
        else:
            windows.append({'start':start-prewarm_seconds,'end':end})
    return windows
