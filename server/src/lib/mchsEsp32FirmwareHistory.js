/** Validate and compare firmware GPIO13 transition ring for one boot epoch.
 * The raw /health response is an observation, not a power command.
 */
const REASONS=new Set(['SIGNED_POWER_PERMIT','SIGNED_PERMIT_FALSE',
 'POWER_INTERLOCK_REJECTED','WIFI_RECONNECT','WIFI_LOST',
 'HEARTBEAT_TIMEOUT','POWER_LEASE_EXPIRED','SIGNED_MAINTENANCE_RESTART',
 'SIGNED_FIRMWARE_UPDATE','FIRMWARE_UPDATE_COMPLETED','SCHEDULED_REBOOT','UNSPECIFIED_OFF']);
const validNonce=v=>typeof v==='string'&&/^[a-f0-9]{16}$/.test(v);
const validEntry=e=>e&&Number.isSafeInteger(e.seq)&&e.seq>=1&&
 Number.isSafeInteger(e.uptimeMs)&&e.uptimeMs>=0&&e.uptimeMs<=4294967295&&
 typeof e.on==='boolean'&&REASONS.has(e.reason);
export function compareEsp32FirmwareHistory(previous,current){
 const cur=current?.relayTransitionHistory;
 const boot=current?.bootNonce;
 if(!validNonce(boot)||!Array.isArray(cur)||cur.length>12||
    !Number.isSafeInteger(current.relayTransitionSequence)||
    current.relayTransitionSequence<0||current.relayTransitionSequence>4294967295||
    cur.some(e=>!validEntry(e)))
  return {available:false,events:[],reason:'FIRMWARE_HISTORY_NOT_AVAILABLE'};
 const ordered=cur.slice().sort((a,b)=>a.seq-b.seq);
 if(ordered.some((e,i)=>i>0&&e.seq!==ordered[i-1].seq+1)||
    (ordered.length&&ordered.at(-1).seq!==current.relayTransitionSequence)||
    (ordered.length===0&&current.relayTransitionSequence>0))
  return {available:false,events:[],reason:'FIRMWARE_HISTORY_INVALID'};
 const sameBoot=previous?.bootNonce===boot;
 const previousSequence=sameBoot&&Number.isSafeInteger(previous?.relayTransitionSequence)?
  previous.relayTransitionSequence:0;
 // First-ever report or first report with an upgraded firmware history
 // is baseline. Legacy firmware snapshots have a bootNonce but no ring cursor;
 // treating seq=0 as previous here would falsely attribute old transitions
 // to the current observation interval.
 if(!previous?.bootNonce || (sameBoot&&
    !Number.isSafeInteger(previous?.relayTransitionSequence)))
  return {available:true,events:[],reason:'BASELINE'};
 if(!sameBoot)return {available:true,events:[],reason:'REBOOT_NEW_EPOCH'};
 if(current.relayTransitionSequence<previousSequence)
  return {available:false,events:[],reason:'FIRMWARE_SEQUENCE_REGRESSION'};
 const entries=ordered.filter(e=>e.seq>previousSequence);
 const missing=entries.length>0&&entries[0].seq>previousSequence+1;
 return {available:true,events:entries.map(e=>({
  kind:e.on?'FIRMWARE_GPIO_ON':'FIRMWARE_GPIO_OFF',
  seq:e.seq,uptimeMs:e.uptimeMs,reason:e.reason
 })),reason:missing?'FIRMWARE_EVENT_HISTORY_OVERFLOW':null};
}
