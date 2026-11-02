"""Download a declared ALARM from the authenticated same-origin Agent asset API.

Does not execute START, enable public broadcast, or change amplifier state.
"""
import hashlib
import hmac
import os
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

from mchs_verified_alarm import verify_cached_alarm

def cache_verified_alarm(command, destination, server, token, *,
                         opener=urlopen, max_bytes=50*1024*1024):
    if not isinstance(command, dict) or command.get('action') != 'START':
        return None, 'INVALID_START'
    # Reuse the strict event, asset, repetition, and digest checks. A missing
    # cache file is expected on the initial download; other errors are not.
    existing, reason = verify_cached_alarm(command, destination, max_bytes=max_bytes)
    if existing is not None:
        return existing, None
    if reason not in ('ASSET_UNAVAILABLE', 'ASSET_DIGEST_MISMATCH'):
        return None, reason
    if not isinstance(server, str) or not server.startswith('https://'):
        return None, 'HTTPS_REQUIRED'
    if not isinstance(token, str) or not token:
        return None, 'DEVICE_AUTH_REQUIRED'
    asset_id=command['assetId']
    directory=Path(destination).resolve()
    directory.mkdir(parents=True,exist_ok=True)
    target=directory/(asset_id+'.alarm')
    partial=directory/(asset_id+'.alarm.part')
    # Never accept arbitrary URLs supplied by the event itself.
    url=server.rstrip('/')+'/api/radio-agent/agent/assets/'+quote(asset_id,safe='')
    digest=hashlib.sha256()
    count=0
    try:
        request=Request(url,headers={'Authorization':'Bearer '+token,
                                      'User-Agent':'MediaRafRadioAgent/MCHS'})
        with opener(request,timeout=30) as response, partial.open('wb') as out:
            while chunk:=response.read(65536):
                count+=len(chunk)
                if count>max_bytes:
                    raise ValueError('ASSET_TOO_LARGE')
                digest.update(chunk)
                out.write(chunk)
        if count==0 or not hmac.compare_digest(digest.hexdigest(),command['sha256']):
            return None, 'ASSET_DIGEST_MISMATCH'
        os.replace(partial,target)
        return verify_cached_alarm(command,directory,max_bytes=max_bytes)
    except (OSError,ValueError) as exc:
        return None, 'ASSET_TOO_LARGE' if str(exc)=='ASSET_TOO_LARGE' else 'DOWNLOAD_FAILED'
    finally:
        partial.unlink(missing_ok=True)
