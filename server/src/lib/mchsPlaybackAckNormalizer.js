/** Strict validation for future event-scoped playback acknowledgements.
 * A trial VLC status without an event identity must never become a real START/STOP ACK.
 */
export function normalizeMchsPlaybackAck(raw,{eventId,eventType,action,nowMs=Date.now()}={}){
 const deny=reason=>({ack:null,reason});
 if(!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(eventType)||!eventId||
    !['START','STOP'].includes(action))return deny('INVALID_EVENT');
 if(!raw||raw.mode!=='EVENT_SCOPED_PLAYBACK'||raw.eventId!==eventId||
    raw.eventType!==eventType||raw.action!==action)return deny('NOT_EVENT_SCOPED');
 if(raw.confirmed!==true||raw.receiptOnly===true)return deny('NOT_PLAYBACK_CONFIRMATION');
 const playbackState=action==='START'?'ACTIVE':'STOPPED';
 if(raw.playbackState!==playbackState)return deny('STATE_NOT_CONFIRMED');
 const at=Date.parse(raw.confirmedAt||'');
 if(!Number.isFinite(at)||at>nowMs||nowMs-at>15000)return deny('STALE_ACK');
 return {ack:{eventId,eventType,action,confirmed:true,playbackState,
  confirmedAt:new Date(at).toISOString()},reason:null};
}
