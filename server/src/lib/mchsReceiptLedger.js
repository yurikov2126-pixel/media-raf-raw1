/** Track event-scoped receipt transitions without pretending that they prove audible output.
 * This reducer is pure and does not issue playback or ESP32 commands.
 */
export function advanceMchsReceiptLedger(raw,{eventId,eventType,channel,observedAt,halted=false,nowMs=Date.now()}={}){
 const old=raw&&typeof raw==='object'&&Array.isArray(raw.receipts)?raw.receipts:[];
 const receipts=old.filter(r=>r&&typeof r.eventId==='string'&&
  ['WORKER','AGENT'].includes(r.channel)&&Number.isFinite(Date.parse(r.observedAt||''))).slice(-200);
 const reject=reason=>({accepted:false,reason,receipts,automaticPlaybackEnabled:false});
 if(halted)return reject('HALTED');
 if(!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(eventType))return reject('TYPE_NOT_ALLOWED');
 if(!['WORKER','AGENT'].includes(channel)||typeof eventId!=='string'||!eventId)return reject('INVALID_RECEIPT');
 const time=Date.parse(observedAt||'');
 if(!Number.isFinite(time)||time>nowMs||nowMs-time>15000)return reject('STALE_RECEIPT');
 if(receipts.some(r=>r.eventId===eventId&&r.channel===channel))return reject('DUPLICATE_RECEIPT');
 return {accepted:true,reason:null,receipts:[...receipts,{eventId,eventType,channel,observedAt:new Date(time).toISOString()}].slice(-200),
  automaticPlaybackEnabled:false};
}
