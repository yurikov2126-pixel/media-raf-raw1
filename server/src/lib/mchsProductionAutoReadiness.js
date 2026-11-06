/** Configuration and transport observation for production MCHS automatic audio.
 * Read-only. Never treat configuration as proof of audible speakers or mains voltage.
 */
const TYPES=['MISSILE_DANGER','MISSILE_ALL_CLEAR'];
export function assessMchsProductionAutoReadiness({
 flags={},allowedChannels=[],rules={},assets=[],worker=null,agent=null,
 esp32=null,deviceBinding=null,androidHealth=null,nowMs=Date.now()
}={}){
 const checks=[];
 const add=(id,ok,reason)=>checks.push({id,ok:ok===true,reason:ok===true?null:reason});
 const isFresh=(value,maxMs)=>{
  const t=Date.parse(value||'');
  return Number.isFinite(t)&&nowMs>=t&&nowMs-t<=maxMs;
 };
 add('ANDROID_INGEST',flags.ingest===true&&flags.hmacConfigured===true,
  'ANDROID_INGEST_DISABLED_OR_HMAC_MISSING');
 add('TRUSTED_CHANNEL',Array.isArray(allowedChannels)&&
  allowedChannels.some(v=>typeof v==='string'&&v.trim()),
  'ANDROID_CHANNEL_ALLOWLIST_EMPTY');
 const android=androidHealth&&typeof androidHealth==='object'?androidHealth:null;
 add('ANDROID_BRIDGE_ONLINE',android?.listener==='CONNECTED'&&
  isFresh(android?.lastSeenAt,90000),'ANDROID_BRIDGE_HEARTBEAT_STALE');
 const library=new Map((Array.isArray(assets)?assets:[]).filter(a=>
  a&&typeof a.id==='string'&&a.category==='ALARM'&&
  typeof a.mimeType==='string'&&a.mimeType.startsWith('audio/')&&
  Number.isFinite(a.durationMs)&&a.durationMs>0).map(a=>[a.id,a]));
 const audio=TYPES.map(type=>{
  const rule=rules[type]||{},asset=library.get(rule.audioAssetId);
  const repeats=type==='MISSILE_ALL_CLEAR'?1:rule.repeats;
  const configured=rule.mode==='REVIEW'&&!!asset&&
   (type==='MISSILE_ALL_CLEAR'||(Number.isInteger(repeats)&&repeats>=1&&repeats<=5));
  add(type,configured,type==='MISSILE_DANGER'?'DANGER_AUDIO_OR_REPEATS_MISSING':
   'ALL_CLEAR_AUDIO_MISSING');
  return {type,configured,assetName:asset?.name||null,repeats:repeats||null};
 });
 add('API_DISPATCH',flags.dispatch===true,'API_DISPATCH_DISABLED');
 add('API_WORKER_COORDINATOR',flags.coordinator===true,'API_COORDINATOR_DISABLED');
 const workerStatus=worker?.ok===true?worker.data:null;
 add('WORKER_AVAILABLE',!!workerStatus,'WORKER_UNREACHABLE');
 add('WORKER_COMMANDS',workerStatus?.enabled===true,'WORKER_MAIN_COMMANDS_DISABLED');
 add('WORKER_JOURNAL',workerStatus?.terminalJournal?.healthy===true,
  'WORKER_TERMINAL_JOURNAL_UNHEALTHY');
 add('AGENT_PRODUCTION_BINDING',deviceBinding?.configured===true&&!!agent,
  'PRODUCTION_AGENT_NOT_BOUND');
 add('AGENT_HEARTBEAT',!!agent&&agent.revokedAt==null&&
  agent.playbackAllowed===true&&isFresh(agent.lastSeenAt,15000),
  'PRODUCTION_AGENT_OFFLINE');
 add('ESP32_TELEMETRY',esp32?.fresh===true&&esp32.heartbeatFresh===true&&
  esp32.relayOutputEnabled===true,'ESP32_STATUS_NOT_CONFIRMED');
 return {readOnly:true,checkedAt:new Date(nowMs).toISOString(),
  checks,holds:checks.filter(x=>!x.ok).map(x=>x.reason),
  configurationReady:checks.every(x=>x.ok),audio,
  channelAllowlistCount:allowedChannels.length,
  androidLastSeenAt:android?.lastSeenAt||null,
  dispatchEnabled:flags.dispatch===true,
  workerCommandsEnabled:workerStatus?.enabled===true,
  actualMainsPowerVerified:false,speakerAudibilityVerified:false,
  automaticAudioTriggered:false};
}
