import {classifyMchsObservation} from './mchsClassification.js';
import {normalizeDangerRepeats} from './mchsAlarmRepeats.js';

/** Bind recent Android observations to the configured ALARM media records.
 * Binding is metadata only. It does not elevate device authentication to
 * proof of official authorship and cannot trigger public or local audio.
 */
export function bindAndroidAlarmCandidates({
 entries=[],observations=[],rules={},assets=[],dangerRepeats=1,nowMs=Date.now()
}={}){
 const byEventId=new Map(observations.map(event=>[event.id,event]));
 const byAssetId=new Map(assets.filter(asset=>
  asset&&asset.category==='ALARM'&&typeof asset.mimeType==='string'&&
  asset.mimeType.startsWith('audio/')&&Number.isFinite(asset.durationMs)&&
  asset.durationMs>0).map(asset=>[asset.id,asset]));
 const eligible=[],rejected=[];
 for(const entry of entries){
  const event=byEventId.get(entry?.eventId);
  let reason=null;
  const type=entry?.eventType;
  if(entry?.result!=='OBSERVED'||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(type))
   reason='OBSERVATION_REJECTED';
  else if(!event||event.sourceEventId!==entry.sourceEventId||
      event.source!=='MCHS_ANDROID'||event.verified!==true)
   reason='EVENT_NOT_VERIFIED';
  else if(classifyMchsObservation(event.title,event.body)!==type)
   reason='EVENT_TYPE_MISMATCH';
  else if(event.region?.trim().toLocaleLowerCase('ru-RU')!=='тульская область')
   reason='REGION_MISMATCH';
  else {
   const at=Date.parse(event.occurredAt||'');
   if(!Number.isFinite(at)||at>nowMs+30000||nowMs-at>120000)
    reason='STALE_EVENT';
  }
  const rule=rules[type];
  if(!reason&&(rule?.mode!=='REVIEW'||!rule.audioAssetId))
   reason='RULE_NOT_CONFIGURED';
  const asset=!reason?byAssetId.get(rule.audioAssetId):null;
  if(!reason&&!asset)reason='ALARM_ASSET_UNAVAILABLE';
  if(reason){
   rejected.push({eventId:entry?.eventId||null,sourceEventId:entry?.sourceEventId||null,
    eventType:type||null,reason});
   continue;
  }
  const repeats=type==='MISSILE_ALL_CLEAR'?1:normalizeDangerRepeats(dangerRepeats);
  eligible.push({eventId:event.id,sourceEventId:event.sourceEventId,
   eventType:type,result:'OBSERVED',audioAssetId:asset.id,repetitions:repeats,
   occurredAt:event.occurredAt,
   expectedDurationMs:asset.durationMs*repeats,
   officialSourceVerified:false,dispatchAuthorized:false});
 }
 return {eligible,rejected,dispatchAuthorized:false,automaticPlaybackEnabled:false};
}

/** Durable, non-executable playback proposals keyed by the Android source ID.
 * One notification cannot be requeued after API restart or monitor retry.
 */
export function stageBoundAndroidIntents(raw,eligible,{now=new Date().toISOString()}={}){
 const prior=raw&&typeof raw==='object'?raw:{};
 const items=Array.isArray(prior.items)?
  prior.items.filter(item=>item&&typeof item.sourceEventId==='string').slice(-250):[];
 const seen=new Set(items.map(item=>item.sourceEventId));
 const added=[];
 for(const candidate of eligible){
  if(candidate?.result!=='OBSERVED'||candidate.officialSourceVerified!==false||
     candidate.dispatchAuthorized!==false||
     !['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(candidate.eventType)||
     !/^[A-Za-z0-9_-]{1,128}$/.test(candidate.audioAssetId||'')||
     !Number.isInteger(candidate.repetitions)||candidate.repetitions<1||
     candidate.repetitions>5||
     (candidate.eventType==='MISSILE_ALL_CLEAR'&&candidate.repetitions!==1)||
     !Number.isSafeInteger(candidate.expectedDurationMs)||
     candidate.expectedDurationMs<=0||
     typeof candidate.sourceEventId!=='string'||!candidate.sourceEventId||
     seen.has(candidate.sourceEventId))continue;
  const intent={sourceEventId:candidate.sourceEventId,eventId:candidate.eventId,
   eventType:candidate.eventType,assetId:candidate.audioAssetId,
   repetitions:candidate.eventType==='MISSILE_ALL_CLEAR'?1:candidate.repetitions,
   expectedDurationMs:candidate.expectedDurationMs,
   status:'STAGED',createdAt:now,occurredAt:candidate.occurredAt,
   officialSourceVerified:false,
   dispatchAuthorized:false};
  seen.add(candidate.sourceEventId);added.push(intent);items.push(intent);
 }
 return {ledger:{items:items.slice(-250),lastUpdated:added.length?now:prior.lastUpdated||null},
  added,dispatchAuthorized:false,automaticPlaybackEnabled:false};
}
