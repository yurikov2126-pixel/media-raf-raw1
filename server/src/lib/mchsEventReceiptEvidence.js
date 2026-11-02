/** Event-scoped receipt decoder for live Worker and Agent diagnostics.
 * No ACK is inferred from heartbeats, connection status, or playbackAllowed.
 */
export function normalizeMchsEventReceipt(raw,{eventId,eventType,nowMs=Date.now(),maxAgeMs=15000}={}){
 if(!raw||typeof raw!=='object'||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(eventType))
  return {receipt:null,reason:'RECEIPT_MISSING'};
 if(raw.eventId!==eventId||raw.eventType!==eventType)
  return {receipt:null,reason:'EVENT_MISMATCH'};
 if(raw.receiptOnly!==true||raw.status!=='RECEIVED')
  return {receipt:null,reason:'NOT_AN_EVENT_RECEIPT'};
 const ts=Date.parse(raw.observedAt||'');
 if(!Number.isFinite(ts)||ts>nowMs||nowMs-ts>maxAgeMs)
  return {receipt:null,reason:'RECEIPT_STALE'};
 return {receipt:{eventId,eventType,observedAt:new Date(ts).toISOString()},reason:null};
}
