"""Read-only Windows standby planner. No playback, VLC or hardware access.

Uses only an already downloaded and SHA256-verified snapshot. The main
central stream continues to be the primary source; this module can diagnose
which cached file would be eligible for local failover.
"""
from datetime import datetime, timezone
import hashlib
from pathlib import Path

def epoch(value):
    return datetime.fromisoformat(value.replace('Z','+00:00')).timestamp()

def verified_file(cache: Path, track):
    ident=track.get('id','')
    checksum=track.get('sha256','')
    if not isinstance(ident,str) or not ident.isalnum():
        return None
    if not isinstance(checksum,str) or len(checksum)!=64:
        return None
    filename=cache/(ident+'.audio')
    if not filename.is_file():
        return None
    digest=hashlib.sha256()
    with filename.open('rb') as source:
        for block in iter(lambda:source.read(1024*1024),b''):
            digest.update(block)
    return filename if digest.hexdigest()==checksum else None

def standby_selection(snapshot, cache:Path, when=None):
    """Return a file descriptor for an approved scheduled item or Auto-DJ.

    Empty/missing or unverifiable sources produce None, never arbitrary audio.
    The caller MUST separately enforce local playback permission.
    """
    now=datetime.now(timezone.utc).timestamp() if when is None else when
    for slot in sorted(snapshot.get('slots',[]), key=lambda item:item['startAt']):
        if not epoch(slot['startAt'])<=now<epoch(slot['endAt']):
            continue
        elapsed=(now-epoch(slot['startAt']))*1000
        for track in slot.get('tracks',[]):
            length=track.get('durationMs',0)
            if not isinstance(length,(int,float)) or length<=0:return None
            if elapsed<length:
                audio=verified_file(cache,track)
                return {'source':'SCHEDULED','file':str(audio),'track':track,'offsetSeconds':elapsed/1000} if audio else None
            elapsed-=length
        return None
    dj=snapshot.get('autoDj') or {}
    if dj.get('enabled') is not True:return None
    tracks=dj.get('tracks',[])
    valid=[track for track in tracks if isinstance(track.get('durationMs'),int) and track['durationMs']>0]
    total=sum(track['durationMs'] for track in valid)
    if not total:return None
    offset=(int(now*1000)%total)
    for track in valid:
        if offset<track['durationMs']:
            audio=verified_file(cache,track)
            return {'source':'AUTO_DJ','file':str(audio),'track':track,'offsetSeconds':offset/1000} if audio else None
        offset-=track['durationMs']
    return None
