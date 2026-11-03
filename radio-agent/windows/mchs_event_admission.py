"""Durable, fail-closed command admission for the MCHS Windows Agent.

This is *metadata admission*, NOT approval to play audio, operate PA,
or dispatch notifications. START never launches audio from this module.
"""
import json
import os
from pathlib import Path

from mchs_event_commands import validate_command


class EventAdmissionLedger:
    def __init__(self, path, *, max_events=256):
        self.path=Path(path)
        self.max_events=max_events
        self.data={'lastSequence':0,'seen':[],'dangerEvent':None,'phase':'IDLE'}
        if self.path.exists():
            try:
                data=json.loads(self.path.read_text(encoding='utf-8'))
                if (type(data.get('lastSequence')) is not int or data['lastSequence']<0
                        or not isinstance(data.get('seen'),list)
                        or any(not isinstance(x,str) for x in data['seen'])
                        or len(data['seen'])>max_events
                        or data.get('phase') not in ('IDLE','DANGER_OBSERVED','ALL_CLEAR_OBSERVED','STOPPED')
                        or (data.get('dangerEvent') is not None and
                            not isinstance(data['dangerEvent'],str))):
                    raise ValueError('INVALID_LEDGER')
                self.data=data
            except (OSError,ValueError,TypeError,KeyError) as error:
                raise RuntimeError('MCHS_EVENT_LEDGER_UNAVAILABLE') from error

    def _save(self):
        self.path.parent.mkdir(parents=True,exist_ok=True)
        temp=self.path.with_suffix(self.path.suffix+'.tmp')
        try:
            with temp.open('w',encoding='utf-8') as stream:
                json.dump(self.data,stream,ensure_ascii=False,sort_keys=True)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temp,self.path)
        finally:
            temp.unlink(missing_ok=True)

    def observe(self,command,*,halted=True,execution_enabled=False,
                physical_isolation=False,now=None):
        """Persist metadata sequence exactly once. Never play a sound."""
        if not isinstance(command,dict):
            return {'accepted':False,'reason':'INVALID_COMMAND','audioStarted':False}
        last=self.data['lastSequence']
        accepted,reason=validate_command(command,last_sequence=last,
                                          halted=halted,now=now)
        if not accepted:
            return {'accepted':False,'reason':reason,'audioStarted':False}
        event_id=command['eventId']
        action=command['action']
        event_type=command['eventType']
        marker=action+':'+event_id
        if marker in self.data['seen']:
            return {'accepted':False,'reason':'REPLAYED_EVENT','audioStarted':False}
        if action=='START':
            if not execution_enabled:
                return {'accepted':False,'reason':'EXECUTION_DISABLED','audioStarted':False}
            if not physical_isolation:
                return {'accepted':False,'reason':'PHYSICAL_ISOLATION_REQUIRED','audioStarted':False}
            if event_type=='MISSILE_ALL_CLEAR' and self.data['phase']!='DANGER_OBSERVED':
                return {'accepted':False,'reason':'DANGER_EVENT_REQUIRED','audioStarted':False}
            if event_type=='MISSILE_DANGER':
                if self.data['phase']=='DANGER_OBSERVED':
                    return {'accepted':False,'reason':'DANGER_ALREADY_OBSERVED','audioStarted':False}
                self.data['dangerEvent']=event_id
                self.data['phase']='DANGER_OBSERVED'
            else:
                self.data['phase']='ALL_CLEAR_OBSERVED'
        else:
            self.data['dangerEvent']=None
            self.data['phase']='STOPPED'
        self.data['lastSequence']=command['sequence']
        self.data['seen']=(self.data['seen']+[marker])[-self.max_events:]
        self._save()
        return {'accepted':True,'reason':'METADATA_ONLY',
                'eventId':event_id,'eventType':event_type,
                'sequence':command['sequence'],'phase':self.data['phase'],
                'audioStarted':False,'physicalPAConfirmed':False}
