import {normalizeDangerRepeats} from './mchsAlarmRepeats.js';
export const MCHS_ANDROID_INTENTS_KEY='mchs_android_execution_intents_v1';
export function normalizeAndroidIntents(raw){
 const value=raw&&typeof raw==='object'?raw:{};
 return {items:Array.isArray(value.items)?value.items.filter(x=>x&&typeof x==='object'&&typeof x.sourceEventId==='string').slice(-250):[],
  lastUpdated:typeof value.lastUpdated==='string'?value.lastUpdated:null};
}
/** Durable candidate registration. Planning is separate from any audio transport. */
export function stageAndroidExecutionIntents(raw,observed,{dangerAssetId=null,clearAssetId=null,dangerRepeats=1,now=new Date().toISOString()}={}){
 const prior=normalizeAndroidIntents(raw),items=[...prior.items],added=[];
 const existing=new Set(items.map(x=>x.sourceEventId));
 for(const entry of observed||[]){
  if(entry.result!=='OBSERVED'||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(entry.eventType))continue;
  if(existing.has(entry.sourceEventId))continue;
  const assetId=entry.eventType==='MISSILE_DANGER'?dangerAssetId:clearAssetId;
  const repetitions=entry.eventType==='MISSILE_DANGER'?normalizeDangerRepeats(dangerRepeats):1;
  const intent={sourceEventId:entry.sourceEventId,eventId:entry.eventId||null,
   eventType:entry.eventType,assetId:assetId||null,repetitions,
   status:'STAGED',createdAt:now,dispatchAuthorized:false};
  existing.add(entry.sourceEventId);items.push(intent);added.push(intent);
 }
 return {ledger:{items:items.slice(-250),lastUpdated:added.length?now:prior.lastUpdated},
  added,automaticPlaybackEnabled:false,dispatchAuthorized:false};
}
