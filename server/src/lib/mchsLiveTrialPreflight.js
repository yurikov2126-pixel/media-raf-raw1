import {MISSILE_AUTO_TYPES} from './mchsMissileAutoGate.js';
/** Acceptance snapshot, never authorizes actuation based solely on telemetry. */
export function assessMchsLiveTrialPreflight({rules={},assets=[],workerReachable=false,agentConfirmed=false,stopConfirmed=false,esp32Ready=false}={}){
 const library=new Set(assets.map(a=>a.id));
 const types=MISSILE_AUTO_TYPES.map(id=>{
  const rule=rules[id]||{};
  const reasons=[];
  if(rule.mode!=='REVIEW')reasons.push('RULE_DISABLED');
  if(!rule.audioAssetId||!library.has(rule.audioAssetId))reasons.push('ALARM_AUDIO_MISSING');
  if(id==='MISSILE_DANGER'&&(!Number.isInteger(rule.repeats)||rule.repeats<1||rule.repeats>5))reasons.push('INVALID_REPEATS');
  return {type:id,audioAssetId:rule.audioAssetId||null,repeats:id==='MISSILE_ALL_CLEAR'?1:rule.repeats||1,configured:reasons.length===0,reasons};
 });
 const holds=[];
 if(!workerReachable)holds.push('WORKER_UNAVAILABLE');
 if(!agentConfirmed)holds.push('AGENT_UNCONFIRMED');
 if(!stopConfirmed)holds.push('STOP_NOT_CONFIRMED');
 if(!esp32Ready)holds.push('ESP32_NOT_CONFIRMED');
 if(types.some(t=>!t.configured))holds.push('ALARM_RULES_INCOMPLETE');
 return {types,holds,configurationReady:holds.length===0,automaticPlaybackEnabled:false,
  publicStreamActuationAuthorized:false,amplifierActuationAuthorized:false,
  output:'READ_ONLY_PREFLIGHT'};
}
