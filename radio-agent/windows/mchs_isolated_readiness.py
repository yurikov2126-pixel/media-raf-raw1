"""Best-effort read-only readiness heartbeat for the isolated headphone pilot.

Never issues playback commands, claims physical PA verification, or logs secrets.
"""
import json
from urllib.request import Request, urlopen
from mchs_event_commands import ISOLATED_TRIAL_SOURCE_ADMISSION_V1

ENDPOINT='/api/radio-agent/agent/mchs-isolated-readiness'

def make_isolated_readiness(assets, central_packets_confirmed):
    if not isinstance(assets,dict):
        raise ValueError('ISOLATED_ASSET_MAP_REQUIRED')
    return {'version':1,'mode':'ISOLATED_EVENT_AUDIO',
            'operatorIsolationAttested':True,
            'isolatedTrialSourceAdmission':ISOLATED_TRIAL_SOURCE_ADMISSION_V1,
            'centralPacketsConfirmed':bool(central_packets_confirmed),
            'assets':{
                'MISSILE_DANGER':assets['MISSILE_DANGER']['sha256'],
                'MISSILE_ALL_CLEAR':assets['MISSILE_ALL_CLEAR']['sha256']
            }}

def post_isolated_readiness(server,token,payload,*,opener=urlopen):
    if not server.startswith('https://') or not token.startswith('rr_'):
        raise ValueError('SECURE_DEVICE_AUTH_REQUIRED')
    request=Request(server.rstrip('/')+ENDPOINT,
                    data=json.dumps(payload).encode('utf-8'),method='POST',
                    headers={'Authorization':'Bearer '+token,
                             'Content-Type':'application/json'})
    with opener(request,timeout=3) as response:
        return response.status==200 and json.load(response).get('accepted') is True
