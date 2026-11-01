import {normalizeDangerRepeats} from './mchsAlarmRepeats.js';

/** Automatic event -> scheduled execution steps. Zero I/O, no Worker access. */
export function buildMchsDryRunExecution({observations=[],rules={},dangerRepeats=1,nowMs=Date.now()}={}){
 const seen=new Set(),steps=[],decisions=[];
 let state='UNKNOWN';
 for(const event of [...observations].sort((a,b)=>Date.parse(a.occurredAt||0)-Date.parse(b.occurredAt||0))){
  const id=event?.sourceEventId;
  const type=event?.eventType;
  const occurred=Date.parse(event?.occurredAt||'');
  let reason=null;
  if(!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(type))reason='TYPE_BLOCKED';
  else if(event.source!=='MCHS_ANDROID'||event.verified!==true)reason='SOURCE_NOT_VERIFIED';
  else if(typeof id!=='string'||!id)reason='NO_SOURCE_EVENT_ID';
  else if(seen.has(id))reason='DUPLICATE';
  else if(!Number.isFinite(occurred)||occurred>nowMs+30000||nowMs-occurred>120000)reason='STALE_EVENT';
  else if(event.region?.trim().toLocaleLowerCase('ru-RU')!=='тульская область')reason='REGION_MISMATCH';
  else if(type==='MISSILE_ALL_CLEAR'&&state!=='DANGER')reason='CLEAR_WITHOUT_DANGER';
  else if(type==='MISSILE_DANGER'&&state==='DANGER')reason='DUPLICATE_DANGER';
  else if(!rules[type]?.audioAssetId)reason='ALARM_ASSET_NOT_CONFIGURED';
  if(reason){decisions.push({eventId:event?.id||null,eventType:type||null,accepted:false,reason});continue;}
  seen.add(id);
  state=type==='MISSILE_DANGER'?'DANGER':'CLEAR';
  const repeats=type==='MISSILE_DANGER'?normalizeDangerRepeats(dangerRepeats):1;
  for(let i=0;i<repeats;i++)steps.push({eventId:event.id,eventType:type,
   assetId:rules[type].audioAssetId,repetition:i+1,total:repeats,action:'WOULD_START_ALARM'});
  decisions.push({eventId:event.id,eventType:type,accepted:true,reason:null});
 }
 return {steps,decisions,finalState:state,mode:'DRY_RUN',audioStarted:false,
  dispatchAuthorized:false,automaticPlaybackEnabled:false};
}
