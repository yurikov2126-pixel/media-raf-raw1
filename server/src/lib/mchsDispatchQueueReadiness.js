/** Fail-closed pre-dispatch decisions; does not issue Worker commands. */
export function assessMchsDispatchQueue(ledger,{operatorHold=true,workerReady=false,agentReady=false,nowMs=Date.now()}={}){
 const items=Array.isArray(ledger?.items)?ledger.items:[];
 const candidates=items.filter(x=>x?.status==='STAGED');
 const decisions=candidates.map(x=>{
  const holds=[];
  if(operatorHold)holds.push('OPERATOR_HOLD');
  if(!workerReady)holds.push('WORKER_NOT_READY');
  if(!agentReady)holds.push('AGENT_NOT_READY');
  if(x.dispatchAuthorized!==false)holds.push('UNEXPECTED_DISPATCH_AUTHORITY');
  if(!x.assetId)holds.push('ASSET_NOT_CONFIGURED');
  const created=Date.parse(x.createdAt||'');
  if(!Number.isFinite(created)||created>nowMs+30000||nowMs-created>120000)holds.push('INTENT_EXPIRED');
  if(!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(x.eventType))holds.push('INVALID_TYPE');
  return {sourceEventId:x.sourceEventId,eventType:x.eventType,
   repetitions:x.eventType==='MISSILE_ALL_CLEAR'?1:x.repetitions,
   ready:false,holds:holds.length?holds:['AUTOMATIC_DISPATCH_DISABLED']};
 });
 return {decisions,staged:candidates.length,automaticPlaybackEnabled:false,
  dispatchAuthorized:false};
}
