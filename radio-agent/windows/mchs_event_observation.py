"""Event-bound Agent observation, local process only; no alarm dispatch."""
import json
from urllib.request import Request, urlopen

ENDPOINT='/api/radio-agent/agent/mchs-event-execution-observation'

def make_event_observation(controller, session):
    """Produce only a terminal event-specific receipt, never a PA acknowledgement."""
    snapshot=controller.snapshot()
    if snapshot['state'] not in ('COMPLETE','FAILED') or not snapshot['eventId']:
        return None
    if not controller.event_type:
        return None
    expected=snapshot['repeats']
    natural=any(item.get('eventId')==snapshot['eventId'] and
                item.get('naturalCompletion') is True and
                item.get('repeats')==expected for item in snapshot['history'])
    returned=any(item.get('eventId')==snapshot['eventId'] and
                 item.get('centralReturned') is True for item in snapshot['history'])
    same=isinstance(session,dict) and session.get('eventId')==snapshot['eventId']
    completed=session.get('completedRepeats',0) if same else 0
    running=session.get('processRunning',False) if same else False
    if type(completed) is not int or not 0<=completed<=expected:
        completed=0
    # Lack of a valid session is a failure, never synthesize natural completion.
    if snapshot['state']=='COMPLETE' and (
            not natural or not returned or running or completed!=expected):
        return None
    return {'version':1,'eventId':snapshot['eventId'],
            'eventType':controller.event_type,
            'phase':snapshot['state'],'expectedRepeats':expected,
            'completedRepeats':completed,'naturalCompletion':natural,
            'centralReturnConfirmed':returned,'processRunning':bool(running),
            'failureReason':snapshot['failure'] if snapshot['state']=='FAILED' else None}

def post_event_observation(server,token,report,*,opener=urlopen):
    if not isinstance(server,str) or not server.startswith('https://'):
        raise ValueError('HTTPS_REQUIRED')
    if not isinstance(token,str) or not token.startswith('rr_'):
        raise ValueError('DEVICE_TOKEN_REQUIRED')
    if not isinstance(report,dict) or report.get('eventId') is None:
        raise ValueError('EVENT_REPORT_REQUIRED')
    payload=json.dumps(report,sort_keys=True).encode('utf-8')
    req=Request(server.rstrip('/')+ENDPOINT,data=payload,method='POST',
                headers={'Authorization':'Bearer '+token,
                         'Content-Type':'application/json'})
    with opener(req,timeout=3) as response:
        if response.status!=200:
            return False
        result=json.load(response)
        return result.get('accepted') is True and result.get('localProcessObservationOnly') is True
