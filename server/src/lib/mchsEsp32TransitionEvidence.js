/** Server-side observations of command/lease changes, not physical voltage. */
export const MCHS_ESP32_TRANSITIONS_KEY='mchs_esp32_transition_evidence_v1';
const MAX_EVENTS=150;
const clean=s=>['ON_COMMANDED','OFF_COMMANDED'].includes(s)?s:'UNKNOWN';
export function recordEsp32Transition(raw,{deviceId,reporterId,observedAt,status}={}){
 const state=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const devices={...(state.devices||{})},events=Array.isArray(state.events)?state.events.slice(-MAX_EVENTS):[];
 if(typeof deviceId!=='string'||!deviceId||typeof reporterId!=='string'||!reporterId||
    !status||typeof status!=='object')return {state:{devices,events},added:[],reason:'INVALID_OBSERVATION'};
 const t=Date.parse(observedAt||'');
 if(!Number.isFinite(t))return {state:{devices,events},added:[],reason:'INVALID_TIME'};
 const next={reporterId,observedAt:new Date(t).toISOString(),
  power:clean(status.amplifierPower),mode:status.agentMode||'UNKNOWN',
  heartbeatFresh:status.heartbeatFresh===true,leaseValid:status.leaseValid===true,
  heartbeatCount:Number.isSafeInteger(status.heartbeatCount)?status.heartbeatCount:null,
  relayOutputEnabled:status.relayOutputEnabled===true,
  bootNonce:typeof status.bootNonce==='string'?status.bootNonce:null,
  relayOnTransitions:Number.isSafeInteger(status.relayOnTransitions)?status.relayOnTransitions:null,
  relayOffTransitions:Number.isSafeInteger(status.relayOffTransitions)?status.relayOffTransitions:null,
  lastRelayTransitionMs:Number.isSafeInteger(status.lastRelayTransitionMs)?status.lastRelayTransitionMs:null,
  lastRelayOffReason:typeof status.lastRelayOffReason==='string'?status.lastRelayOffReason:null};
 const prev=devices[deviceId];
 const prevTime=Date.parse(prev?.observedAt||'');
 if(prev&&(!Number.isFinite(prevTime)||t<=prevTime))
  return {state:{devices,events},added:[],reason:'OLD_OR_DUPLICATE_OBSERVATION'};
 const changes=[];
 const add=(kind,detail)=>changes.push({deviceId,reporterId,at:next.observedAt,kind,detail});
 if(prev&&prev.reporterId!==reporterId)add('REPORTER_CHANGED','OBSERVATION_SOURCE_CHANGED');
 if(prev&&t-prevTime>12000)add('TELEMETRY_GAP',String(t-prevTime));
 if(prev&&prev.power!==next.power)add('COMMANDED_POWER_CHANGED',prev.power+'_TO_'+next.power);
 if(prev&&prev.leaseValid!==next.leaseValid)add('LEASE_CHANGED',next.leaseValid?'VALID':'INVALID');
 if(prev&&prev.heartbeatFresh!==next.heartbeatFresh)add('HEARTBEAT_CHANGED',next.heartbeatFresh?'FRESH':'STALE');
 if(prev&&prev.mode!==next.mode)add('AGENT_MODE_CHANGED',prev.mode+'_TO_'+next.mode);
 if(prev&&prev.heartbeatCount!==null&&next.heartbeatCount!==null&&
    next.heartbeatCount<prev.heartbeatCount)add('HEARTBEAT_COUNTER_RESET','ESP32_REBOOT_OR_COUNTER_RESET');
 // Firmware counters detect transitions that occurred between two HTTP polls.
 if(prev&&prev.bootNonce&&next.bootNonce&&prev.bootNonce!==next.bootNonce){
  add('FIRMWARE_REBOOT','BOOT_NONCE_CHANGED');
 }else if(prev&&prev.bootNonce&&prev.bootNonce===next.bootNonce){
  if(next.relayOnTransitions!==null&&prev.relayOnTransitions!==null){
   if(next.relayOnTransitions>prev.relayOnTransitions)
    add('FIRMWARE_RELAY_ON',String(next.relayOnTransitions-prev.relayOnTransitions));
   else if(next.relayOnTransitions<prev.relayOnTransitions)
    add('FIRMWARE_COUNTER_RESET','ON_COUNTER_DECREASED');
  }
  if(next.relayOffTransitions!==null&&prev.relayOffTransitions!==null){
   if(next.relayOffTransitions>prev.relayOffTransitions)
    add('FIRMWARE_RELAY_OFF',String(next.relayOffTransitions-prev.relayOffTransitions)+':'+
      (next.lastRelayOffReason||'UNKNOWN'));
   else if(next.relayOffTransitions<prev.relayOffTransitions)
    add('FIRMWARE_COUNTER_RESET','OFF_COUNTER_DECREASED');
  }
 }
 devices[deviceId]=next;
 return {state:{devices,events:[...events,...changes].slice(-MAX_EVENTS)},added:changes,reason:null};
}
export function assessEsp32TransitionEvidence(raw,{deviceId,nowMs=Date.now(),windowMs=10*60*1000}={}){
 const entries=Array.isArray(raw?.events)?raw.events.filter(e=>e.deviceId===deviceId&&
  Number.isFinite(Date.parse(e.at))&&nowMs-Date.parse(e.at)>=0&&nowMs-Date.parse(e.at)<=windowMs):[];
 const suspect=entries.filter(e=>['COMMANDED_POWER_CHANGED','LEASE_CHANGED','TELEMETRY_GAP',
  'HEARTBEAT_CHANGED','HEARTBEAT_COUNTER_RESET','REPORTER_CHANGED',
  'FIRMWARE_RELAY_OFF','FIRMWARE_COUNTER_RESET','FIRMWARE_REBOOT'].includes(e.kind));
 return {readOnly:true,windowMs,events:entries.slice(-70),suspectCount:suspect.length,
  stabilityConfirmed:false,actualMainsPowerVerified:false};
}
