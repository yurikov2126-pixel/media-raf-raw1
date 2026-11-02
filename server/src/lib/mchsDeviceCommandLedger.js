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
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(input.eventId||'')||
   !['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(input.eventType))return fail('INVALID_EVENT');
  return {ok:true,state:{...current,sequence:current.sequence+1,
   pending:{version:1,sequence:current.sequence+1,action:'STOP',
    eventId:input.eventId,eventType:input.eventType,
    createdAt:new Date(nowMs).toISOString(),expiresAt:new Date(nowMs+15000).toISOString()}}};
 }
 if(input?.type==='QUEUE_START'){
  // There is no safe automatic START until the public authorization and
  // genuine event-to-asset proof can be established end-to-end.
  return fail('REAL_EVENT_AUTOMATIC_START_NOT_AUTHORIZED');
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
   pending.action!=='STOP')return fail('STOP_NOT_CONFIRMED');
  return {ok:true,state:{...current,pending:null,lastReceipt:{
   ...receipt,receivedAt:new Date(nowMs).toISOString()}}};
 }
 return fail('UNKNOWN_ACTION');
}
