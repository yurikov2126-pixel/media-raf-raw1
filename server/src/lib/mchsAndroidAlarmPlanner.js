import {classifyMchsObservation} from './mchsClassification.js';
import {normalizeDangerRepeats} from './mchsAlarmRepeats.js';

/** Pure transition planner, never sends audio. State is authoritative per event stream. */
export function planMchsAndroidAlarmEvent({event,checkpoint,settings={},nowMs=Date.now()}={}){
 const state=checkpoint?.state==='DANGER'?'DANGER':checkpoint?.state==='CLEAR'?'CLEAR':'UNKNOWN';
 const type=classifyMchsObservation(event?.title,event?.body);
 const base={eventId:event?.id||null,eventType:type,previousState:state,
  action:'NONE',steps:[],dispatchAuthorized:false,automaticPlaybackEnabled:false};
 const block=reason=>({...base,reason,nextState:state});
 if(!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(type))return block('UNSUPPORTED_TYPE');
 if(event?.source!=='MCHS_ANDROID'||event?.verified!==true)return block('UNVERIFIED_OBSERVATION');
 if(!event?.sourceEventId||typeof event.sourceEventId!=='string')return block('MISSING_SOURCE_ID');
 if(checkpoint?.processedIds?.includes(event.sourceEventId))return block('DUPLICATE');
 if(event?.region?.trim().toLocaleLowerCase('ru-RU')!=='тульская область')return block('REGION_MISMATCH');
 const timestamp=Date.parse(event.occurredAt||'');
 if(!Number.isFinite(timestamp)||timestamp>nowMs+30000||nowMs-timestamp>120000)return block('STALE_EVENT');
 const previousTime=Date.parse(checkpoint?.lastOccurredAt||'');
 if(Number.isFinite(previousTime)&&timestamp<=previousTime)return block('OUT_OF_ORDER');
 if(type==='MISSILE_DANGER'){
  if(state==='DANGER')return block('ALREADY_IN_DANGER');
  if(!settings.dangerAssetId)return block('DANGER_ALARM_NOT_CONFIGURED');
  const repeats=normalizeDangerRepeats(settings.dangerRepeats);
  return {...base,action:'DANGER_SEQUENCE',nextState:'DANGER',reason:null,
   steps:Array.from({length:repeats},(_,i)=>({assetId:settings.dangerAssetId,
    repetition:i+1,total:repeats,stage:'DANGER'}))};
 }
 if(state!=='DANGER')return block('CLEAR_WITHOUT_ACTIVE_DANGER');
 if(!settings.clearAssetId)return block('CLEAR_ALARM_NOT_CONFIGURED');
 return {...base,action:'ALL_CLEAR_SEQUENCE',nextState:'CLEAR',reason:null,
  steps:[{assetId:settings.clearAssetId,repetition:1,total:1,stage:'ALL_CLEAR'}]};
}
