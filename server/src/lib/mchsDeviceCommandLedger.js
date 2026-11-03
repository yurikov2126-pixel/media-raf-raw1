/** One-command-per-device MCHS transport ledger. Storage of the ledger
 * must be transactional: do not confuse delivery with audible playback.
 */
export function advanceMchsDeviceCommand(state={},input,{nowMs=Date.now()}={}){
 const current={sequence:state.sequence||0,pending:state.pending||null,
  lastReceipt:state.lastReceipt||null,halted:state.halted!==false};
 const fail=reason=>({ok:false,reason,state:current});
 if(input?.type==='HALT'){
  const sequence=current.sequence+1;
  const pending=current.pending;
  return {ok:true,state:{...current,sequence,halted:true,
   pending:pending&&pending.action==='START'?null:pending},
   cancelledEventId:pending?.action==='START'?pending.eventId:null};
 }
 if(input?.type==='QUEUE_STOP'){
  // Never silently replace a pending STOP for a different event: the Agent
  // must first receive the earlier emergency stop, or it must expire.
  if(current.pending?.action==='STOP'&&
     (current.pending.eventId!==input.eventId||
      current.pending.eventType!==input.eventType)&&
     Date.parse(current.pending.expiresAt)>nowMs)
   return fail('PRIOR_STOP_NOT_ACKNOWLEDGED');
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(input.eventId||'')||
   !['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(input.eventType))return fail('INVALID_EVENT');
  // Retrying the same emergency STOP must not invalidate an in-flight
  // receipt by constantly incrementing the command sequence.
  if(current.pending?.action==='STOP'&&
     current.pending.eventId===input.eventId&&
     current.pending.eventType===input.eventType&&
     Date.parse(current.pending.expiresAt)>nowMs)
   return {ok:true,state:current,alreadyQueued:true};
  return {ok:true,state:{...current,sequence:current.sequence+1,
   pending:{version:1,sequence:current.sequence+1,action:'STOP',
    eventId:input.eventId,eventType:input.eventType,
    createdAt:new Date(nowMs).toISOString(),expiresAt:new Date(nowMs+15000).toISOString()}}};
 }
 if(input?.type==='QUEUE_START'){
  // START can be staged only inside a separately authorized, physically
  // isolated trial. A normal device ledger is permanently halted by default.
  // The live device route still enforces STOP-only delivery.
  if(current.halted)return fail('HALT_ACTIVE');
  if(current.pending)return fail('COMMAND_ALREADY_PENDING');
  const a=input.authorization;
  if(!a||a.mode!=='ISOLATED_TRIAL'||a.approved!==true||
     a.publicStreamAllowed!==false||a.amplifierAllowed!==false||
     a.outputIsolationVerified!==true)return fail('ISOLATION_NOT_VERIFIED');
  if(input.sourceOfficiallyVerified!==true)return fail('SOURCE_NOT_VERIFIED');
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(input.eventId||'')||
     !/^[A-Za-z0-9_-]{1,128}$/.test(input.assetId||'')||
     !['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(input.eventType)||
     !/^[a-f0-9]{64}$/.test(input.sha256||'')||
     !Number.isInteger(input.repeats)||input.repeats<1||input.repeats>5||
     (input.eventType==='MISSILE_ALL_CLEAR'&&input.repeats!==1))
    return fail('INVALID_EVENT_AUDIO');
  const sequence=current.sequence+1;
  return {ok:true,state:{...current,sequence,pending:{
   version:1,sequence,action:'START',eventId:input.eventId,
   eventType:input.eventType,assetId:input.assetId,
   sha256:input.sha256,repeats:input.repeats,officialSourceVerified:true,
   trialOnly:true,createdAt:new Date(nowMs).toISOString(),
   expiresAt:new Date(nowMs+10000).toISOString()
  }}};
 }
 if(input?.type==='DELIVER'){
  if(!current.pending)return {ok:true,state:current,command:null};
  if(Date.parse(current.pending.expiresAt)<=nowMs)
   return {ok:true,state:{...current,pending:null},command:null,expired:true};
  return {ok:true,state:current,command:current.pending};
 }
 if(input?.type==='RECEIPT'){
  const receipt=input.receipt;
  const pending=current.pending;
  if(!pending||receipt?.sequence!==pending.sequence||
   receipt.eventId!==pending.eventId||receipt.eventType!==pending.eventType||
   receipt.action!==pending.action)return fail('COMMAND_RECEIPT_MISMATCH');
  if(receipt.confirmed!==true||receipt.playbackState!=='STOPPED'||
   pending.action!=='STOP'||receipt.localTrialStoppedConfirmed!==true)
   return fail('STOP_NOT_CONFIRMED');
  // A receipt without trustworthy time and local termination evidence does
  // not establish that the commanded process actually stopped.
  const confirmedAt=Date.parse(receipt.confirmedAt||'');
  if(!Number.isFinite(confirmedAt)||confirmedAt>nowMs+5000||
   nowMs-confirmedAt>15000)return fail('STALE_STOP_RECEIPT');
  return {ok:true,state:{...current,pending:null,lastReceipt:{
   ...receipt,receivedAt:new Date(nowMs).toISOString()}}};
 }
 return fail('UNKNOWN_ACTION');
}
