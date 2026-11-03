import {classifyMchsObservation} from './mchsClassification.js';

const ID=/^[A-Za-z0-9_-]{1,128}$/;
const EVENT_TYPES=new Set(['MISSILE_DANGER','MISSILE_ALL_CLEAR']);
const deny=(state,reason)=>({state,command:null,reason});

/** Durable, local-HEADPHONES-ONLY event feed. Never authorizes station audio.
 * Origin: authenticated Android bridge and allowlisted channel, NOT official provenance.
 * Only a separately operator-armed Agent can reproduce this audio.
 */
export function advanceIsolatedAndroidAutoFeed(raw,{events=[],observations=[],
 readiness=null,allowedChannels=[],dangerRepeats=1,nowMs=Date.now()}={}){
 const old=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const state={sequence:Number.isSafeInteger(old.sequence)&&old.sequence>=0?old.sequence:0,
  phase:['CLEAR','DANGER'].includes(old.phase)?old.phase:'CLEAR',
  active:old.active&&typeof old.active==='object'?old.active:null,
  seen:Array.isArray(old.seen)?old.seen.filter(x=>typeof x==='string').slice(-250):[]};
 if(!readiness?.fresh||!readiness.operatorIsolationAttested||
    !readiness.centralPacketsConfirmed)return deny(state,'ISOLATED_AGENT_NOT_READY');
 if(!Array.isArray(allowedChannels)||!allowedChannels.length)
  return deny(state,'ANDROID_CHANNEL_ALLOWLIST_EMPTY');
 if(state.active){
  const command=state.active.command;
  const result=observations.find(x=>x.eventId===command?.eventId);
  if(result?.phase==='FAILED'){
   return deny({...state,active:null,phase:'CLEAR'},'PRIOR_LOCAL_AUDIO_FAILED');
  }
  if(result?.phase==='COMPLETE'&&result.naturalCompletion===true&&
     result.centralReturnConfirmed===true&&result.processRunning===false&&
     result.completedRepeats===result.expectedRepeats){
   state.active=null;
  }else if(command&&Date.parse(command.expiresAt)>nowMs){
   return {state,command,reason:'ALREADY_QUEUED'};
  }else return deny(state,'AWAITING_LOCAL_COMPLETION');
 }
 const ordered=[...events].sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt));
 for(const event of ordered){
  if(event?.source!=='MCHS_ANDROID'||!ID.test(event.id||'')||
     typeof event.sourceEventId!=='string'||!event.sourceEventId||
     state.seen.includes(event.sourceEventId))continue;
  const eventType=classifyMchsObservation(event.title,event.body);
  if(!EVENT_TYPES.has(eventType))continue;
  if(event.region?.trim().toLocaleLowerCase('ru-RU')!=='тульская область')continue;
  if(!allowedChannels.includes(event.channelId))continue;
  const at=Date.parse(event.occurredAt||'');
  if(!Number.isFinite(at)||at>nowMs||nowMs-at>120000)continue;
  if((eventType==='MISSILE_DANGER'&&state.phase==='DANGER')||
     (eventType==='MISSILE_ALL_CLEAR'&&state.phase!=='DANGER'))continue;
  const sha256=readiness.assets?.[eventType];
  if(!/^[a-f0-9]{64}$/.test(sha256||''))continue;
  const repeats=eventType==='MISSILE_ALL_CLEAR'?1:
   (Number.isSafeInteger(dangerRepeats)&&dangerRepeats>=1&&dangerRepeats<=5?dangerRepeats:1);
  const sequence=state.sequence+1;
  const command={version:1,sequence,action:'START',eventId:event.id,eventType,
   assetId:eventType==='MISSILE_DANGER'?'isolated_danger':'isolated_clear',
   sha256,repeats,trialOnly:true,trialSourceAccepted:true,
   officialSourceVerified:false,createdAt:new Date(nowMs).toISOString(),
   expiresAt:new Date(nowMs+10000).toISOString()};
  return {state:{...state,sequence,phase:eventType==='MISSILE_DANGER'?'DANGER':'CLEAR',
    seen:[...state.seen,event.sourceEventId].slice(-250),active:{command}},
   command,reason:'ISOLATED_ANDROID_TRIAL_ONLY'};
 }
 return deny(state,'NO_NEW_ANDROID_EVENT');
}
