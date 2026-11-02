/** Event-bound Agent command contract. Invalid, stale, replayed or HALTed
 * commands cannot be promoted into playback authorization.
 */
export const MCHS_AGENT_COMMAND_VERSION=1;
export function validateMchsAgentCommand(command,{nowMs=Date.now(),lastSequence=0,halted=true}={}){
 const reject=reason=>({accepted:false,reason});
 if(!command||command.version!==MCHS_AGENT_COMMAND_VERSION||
  !['START','STOP'].includes(command.action)||
  !Number.isSafeInteger(command.sequence)||command.sequence<1)
  return reject('INVALID_COMMAND');
 if(command.sequence<=lastSequence)return reject('REPLAYED_SEQUENCE');
 if(typeof command.eventId!=='string'||!/^[-_a-zA-Z0-9]{1,128}$/.test(command.eventId))
  return reject('INVALID_EVENT_ID');
 if(!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(command.eventType))
  return reject('INVALID_EVENT_TYPE');
 const created=Date.parse(command.createdAt||'');
 const expires=Date.parse(command.expiresAt||'');
 if(!Number.isFinite(created)||!Number.isFinite(expires)||created>nowMs+5000||
  expires<=nowMs||expires-created>30000)return reject('EXPIRED_COMMAND');
 if(command.action==='START'){
  if(halted)return reject('HALT_ACTIVE');
  if(command.officialSourceVerified!==true)return reject('SOURCE_NOT_VERIFIED');
  if(typeof command.assetId!=='string'||!command.assetId||
   !Number.isInteger(command.repeats)||command.repeats<1||command.repeats>5)
   return reject('INVALID_AUDIO_SPEC');
  if(command.eventType==='MISSILE_ALL_CLEAR'&&command.repeats!==1)
   return reject('INVALID_ALL_CLEAR_REPEATS');
 }
 return {accepted:true,reason:null,eventId:command.eventId,
  eventType:command.eventType,action:command.action,sequence:command.sequence};
}
export function assessMchsAgentCommandReceipt(command,receipt,{nowMs=Date.now()}={}){
 if(!receipt||receipt.version!==1||receipt.eventId!==command?.eventId||
  receipt.sequence!==command.sequence||receipt.action!==command.action||
  receipt.eventType!==command.eventType||receipt.confirmed!==true)
  return {confirmed:false,reason:'RECEIPT_MISMATCH'};
 if(command.action==='START'&&receipt.playbackState!=='ACTIVE')
  return {confirmed:false,reason:'PLAYBACK_NOT_ACTIVE'};
 if(command.action==='STOP'&&receipt.playbackState!=='STOPPED')
  return {confirmed:false,reason:'PLAYBACK_NOT_STOPPED'};
 const at=Date.parse(receipt.confirmedAt||'');
 if(!Number.isFinite(at)||at>nowMs+5000||nowMs-at>15000)
  return {confirmed:false,reason:'STALE_RECEIPT'};
 return {confirmed:true,reason:null};
}
