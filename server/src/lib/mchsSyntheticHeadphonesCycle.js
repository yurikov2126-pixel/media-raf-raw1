/** Synthetic two-event HEADPHONES-only verification; never writes an Android warning.
 * Caller must enforce feature gate, bound device, current agent readiness, HALT
 * and admin auth before arming or returning any commands.
 */
const TERMINAL=new Set(['COMPLETE','FAILED']);
export function stageSyntheticHeadphonesCycle({state,readiness,nowMs=Date.now(),id}={}){
 if(state&&['DANGER_PENDING','DANGER_WAIT','CLEAR_PENDING','CLEAR_WAIT'].includes(state.phase))
  return {ok:false,reason:'CYCLE_ALREADY_ACTIVE'};
 if(!readiness?.fresh||!readiness.operatorIsolationAttested||
    !readiness.centralPacketsConfirmed)return {ok:false,reason:'AGENT_NOT_READY'};
 if(readiness.isolatedTrialSourceAdmission!==true)
  return {ok:false,reason:'WINDOWS_AGENT_UPDATE_REQUIRED'};
 if(!/^synthetic_[a-f0-9]{24}$/.test(id||''))
  return {ok:false,reason:'INVALID_SYNTHETIC_ID'};
 const sequence=Math.max(Number.isSafeInteger(state?.sequence)?state.sequence+1:1,nowMs);
 return {ok:true,state:{phase:'DANGER_PENDING',sequence,baseId:id,
  dangerId:id+'_danger',clearId:id+'_clear',startedAt:new Date(nowMs).toISOString(),
  active:null,failReason:null}};
}
export function advanceSyntheticHeadphonesCycle(state,{
 readiness,observations=[],nowMs=Date.now()}={}){
 if(!state||typeof state!=='object')return {state,command:null,reason:'NOT_ARMED'};
 const no=(reason,next=state)=>({state:next,command:null,reason});
 if(TERMINAL.has(state.phase))return no(state.phase);
 const active=state.active;
 if(state.phase==='DANGER_WAIT'||state.phase==='CLEAR_WAIT'){
  const observation=observations.find(o=>o.eventId===active?.eventId);
  if(observation?.phase==='FAILED')
   return no('PLAYBACK_FAILED',{...state,phase:'FAILED',failReason:'PLAYBACK_FAILED',active:null});
  if(observation?.phase==='COMPLETE'){
   const complete=observation.naturalCompletion===true&&
    observation.centralReturnConfirmed===true&&observation.processRunning===false&&
    observation.completedRepeats===observation.expectedRepeats;
   if(!complete)return no('INCOMPLETE_OBSERVATION');
   return no('AWAITING_NEXT_POLL',{...state,
    phase:state.phase==='DANGER_WAIT'?'CLEAR_PENDING':'COMPLETE',active:null});
  }
  if(active&&Date.parse(active.expiresAt)>nowMs)
   return {state,command:active,reason:'IN_FLIGHT_REDELIVERY'};
  // An unanswered delivery must terminate rather than permanently jam the
  // operator rehearsal. Never infer successful sound or queue ALL_CLEAR.
  const at=Date.parse(active?.createdAt||'');
  if(Number.isFinite(at)&&nowMs-at>60000)
   return no('AGENT_COMPLETION_TIMEOUT',{...state,phase:'FAILED',
    failReason:'AGENT_COMPLETION_TIMEOUT',active:null});
  return no('AWAITING_AGENT_COMPLETION');
 }
 if(!['DANGER_PENDING','CLEAR_PENDING'].includes(state.phase))
  return no('INVALID_STATE');
 if(!readiness?.fresh||!readiness.operatorIsolationAttested||
    !readiness.centralPacketsConfirmed)return no('AGENT_NOT_READY');
 if(readiness.isolatedTrialSourceAdmission!==true)
  return no('WINDOWS_AGENT_UPDATE_REQUIRED');
 const danger=state.phase==='DANGER_PENDING';
 const eventType=danger?'MISSILE_DANGER':'MISSILE_ALL_CLEAR';
 const sha256=readiness.assets?.[eventType];
 if(!/^[a-f0-9]{64}$/.test(sha256||''))return no('LOCAL_WAV_UNAVAILABLE');
 const repeats=danger?1:1;
 const sequence=Math.max(state.sequence+1,nowMs);
 const eventId=danger?state.dangerId:state.clearId;
 const command={version:1,action:'START',sequence,eventId,eventType,
  assetId:danger?'isolated_danger':'isolated_clear',sha256,repeats,
  trialOnly:true,syntheticTraining:true,trialSourceAccepted:true,
  officialSourceVerified:false,createdAt:new Date(nowMs).toISOString(),
  expiresAt:new Date(nowMs+10000).toISOString()};
 return {state:{...state,sequence,phase:danger?'DANGER_WAIT':'CLEAR_WAIT',active:command},
  command,reason:'SYNTHETIC_HEADPHONES_ONLY'};
}
