/** A bounded, non-executing receipt registry for the radio worker.
 * No PCM, alarm selection, or broadcast side effects.
 */
export function createMchsCommandReceiptStore({maxEntries=512}={}){
 const receipts=new Map();
 function receive({commandId,eventType,leaseToken}={}){
  if(typeof commandId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(commandId)||
   !['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(eventType)||
   typeof leaseToken!=='string'||!/^[a-f0-9]{48}$/.test(leaseToken))
   return {ok:false,reason:'INVALID_COMMAND'};
  const previous=receipts.get(commandId);
  if(previous)return {ok:true,duplicate:true,receipt:previous};
  const receipt={commandId,eventType,status:'RECEIVED_DRY_RUN',receivedAt:new Date().toISOString(),
   playbackStarted:false};
  receipts.set(commandId,receipt);
  while(receipts.size>maxEntries)receipts.delete(receipts.keys().next().value);
  return {ok:true,duplicate:false,receipt};
 }
 return {receive,get(id){return receipts.get(id)||null;}};
}
