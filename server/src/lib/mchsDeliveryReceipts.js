/** Read-only correlation of observed acknowledgements for the two-channel MCHS path.
 * Receipt means a specific component observed an event, not that audio was audible.
 */
export function assessMchsDeliveryReceipts({envelope,workerReceipt,agentReceipt,nowMs=Date.now()}={}){
 const holds=[];
 if(!envelope||envelope.mode!=='NOT_EXECUTABLE'||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(envelope.eventType))
  holds.push('ENVELOPE_INVALID');
 const expires=Date.parse(envelope?.expiresAt||'');
 const issued=Date.parse(envelope?.issuedAt||'');
 if(!Number.isFinite(issued)||!Number.isFinite(expires)||expires<=issued||
    expires-issued>5000||nowMs>expires||nowMs<issued)holds.push('ENVELOPE_EXPIRED');
 for(const [channel,receipt] of [['WORKER',workerReceipt],['AGENT',agentReceipt]]){
  if(!receipt||receipt.eventId!==envelope?.eventId||receipt.eventType!==envelope?.eventType)
   holds.push(channel+'_RECEIPT_MISSING_OR_MISMATCHED');
  const observed=Date.parse(receipt?.observedAt||'');
  if(!Number.isFinite(observed)||observed<issued||observed>nowMs+30000||nowMs-observed>15000)
   holds.push(channel+'_RECEIPT_STALE');
 }
 return {correlated:holds.length===0,holds,
  audioAudibilityVerified:false,publicPlaybackAuthorized:false,amplifierAuthorized:false};
}
