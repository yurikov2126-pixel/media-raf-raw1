#!/usr/bin/env python3
"""Radio 2.0 Windows Agent, phase 1: download/verify only, NEVER play audio."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request

def fetch(base, token, route):
    request = urllib.request.Request(base.rstrip('/') + route, headers={
        'Authorization': 'Bearer ' + token, 'User-Agent': 'MediaRafRadioAgent/0.1'
    })
    return urllib.request.urlopen(request, timeout=40)

def sync(base, token, destination):
    with fetch(base, token, '/api/radio-agent/agent/status') as response:
        status=json.load(response)
    if status.get('playbackEnabled') is not False or status.get('mode') != 'SYNC_ONLY':
        raise RuntimeError('Unsupported radio mode — refusing to continue')
    with fetch(base, token, '/api/radio-agent/agent/snapshot') as response:
        snapshot=json.load(response)
    if snapshot.get('playbackEnabled') is not False or snapshot.get('mode') != 'SYNC_ONLY':
        raise RuntimeError('Snapshot is not marked sync-only')
    cache=destination / 'cache'
    cache.mkdir(parents=True, exist_ok=True)
    assets={}
    for slot in snapshot['slots']:
        for item in slot['tracks']:
            assets[item['id']]=item
    for asset_id,item in assets.items():
        digest=item['sha256']
        if not isinstance(digest,str) or len(digest)!=64 or not all(c in '0123456789abcdef' for c in digest):
            raise ValueError('Invalid asset hash')
        if not asset_id.isalnum():
            raise ValueError('Invalid asset id')
        final=cache / (asset_id + '.audio')
        if final.exists() and hashlib.sha256(final.read_bytes()).hexdigest()==digest:
            continue
        partial=cache / (asset_id + '.part')
        sha=hashlib.sha256()
        count=0
        try:
            with fetch(base, token, '/api/radio-agent/agent/assets/' + asset_id) as source, partial.open('wb') as out:
                while chunk:=source.read(1024*1024):
                    count+=len(chunk)
                    if count>100*1024*1024:
                        raise ValueError('Asset exceeds client safety limit')
                    sha.update(chunk)
                    out.write(chunk)
            if sha.hexdigest()!=digest or count!=item['byteSize']:
                raise ValueError('Downloaded audio checksum or size mismatch: '+asset_id)
            os.replace(partial,final)
        finally:
            partial.unlink(missing_ok=True)
    temp=destination / 'snapshot.part'
    temp.write_text(json.dumps(snapshot,ensure_ascii=False,indent=2),encoding='utf-8')
    os.replace(temp,destination/'snapshot.json')
    print('Revision:',snapshot['revision'],'Broadcast slots:',len(snapshot['slots']),
          'Cached assets:',len(assets),'Playback: DISABLED',flush=True)

def main():
    p=argparse.ArgumentParser(description='MEDIA RAF RAW radio sync agent (no playout)')
    p.add_argument('--server',required=True,help='https://mediarafraw.ru (HTTPS required)')
    p.add_argument('--data-dir',default='radio-agent-data')
    p.add_argument('--once',action='store_true')
    p.add_argument('--interval',type=int,default=60)
    args=p.parse_args()
    if not args.server.startswith('https://') or not 30<=args.interval<=3600:
        p.error('HTTPS required and interval must be 30..3600 seconds')
    token=os.environ.get('RADIO_AGENT_TOKEN','').strip()
    if not token:
        p.error('RADIO_AGENT_TOKEN environment variable missing')
    destination=Path(args.data_dir).resolve()
    destination.mkdir(parents=True,exist_ok=True)
    while True:
        try: sync(args.server,token,destination)
        except (OSError,ValueError,KeyError,urllib.error.URLError,RuntimeError) as exc:
            print('Sync failed:',exc,file=sys.stderr,flush=True)
            if args.once: return 1
        if args.once: return 0
        time.sleep(args.interval)

if __name__=='__main__':
    sys.exit(main())
