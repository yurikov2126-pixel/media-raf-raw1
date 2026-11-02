/** Confirm both output channels against event-scoped evidence, fail closed.
 * Does not dispatch audio, infer START from receipt-only metadata, or control PA.
 */
export function assessMchsDualChannelTransition({eventId,eventType,action,worker,agent,nowMs=Date.now()}={}){
 const holds=[];
 if(!eventId||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(eventType))holds.push('INVALID_EVENT');
 if(!['START','STOP'].includes(action))holds.push('INVALID_ACTION');
 const check=(channel,evidence)=>{
  if(!evidence||evidence.eventId!==eventId||evidence.eventType!==eventType||evidence.action!==action){
   holds.push(channel+'_EVENT_MISMATCH');return;
  }
  const at=Date.parse(evidence.confirmedAt||'');
  if(!Number.isFinite(at)||at>nowMs||nowMs-at>15000){
   holds.push(channel+'_STALE');return;
  }
  if(evidence.confirmed!==true)holds.push(channel+'_UNCONFIRMED');
  if(action==='START'&&evidence.playbackState!=='ACTIVE')holds.push(channel+'_NOT_ACTIVE');
  if(action==='STOP'&&evidence.playbackState!=='STOPPED')holds.push(channel+'_NOT_STOPPED');
 };
 check('WORKER',worker);check('AGENT',agent);
 return {eventId:eventId||null,eventType:eventType||null,action:action||null,
  bothConfirmed:holds.length===0,holds,
  publicBroadcastEnabled:false,automaticDispatchEnabled:false,
  physicalAudibilityVerified:false,output:'EVIDENCE_ONLY'};
}
