// A replacement clock for an interrupted scheduled playlist. Unlike
// resolveRadioCursor, this clock starts at the next track *after* the marker,
// and remains constrained by the original approved slot end.
export function resolveHourlyScheduledResume(reservation,{slot,items,nowMs,live=false}={}){
 const deny=reason=>({ok:false,reason});
 if(!reservation?.ok)return deny('NO_RESERVATION');
 if(live)return deny('LIVE_PRIORITY');
 if(!slot||slot.id!==reservation.slotId||slot.playlistId!==reservation.playlistId||
    Date.parse(slot.endAt)!==reservation.slotEndMs)return deny('SLOT_CHANGED');
 if(!Number.isFinite(nowMs)||nowMs<reservation.resumeAfterMs||nowMs>=reservation.slotEndMs)
   return deny('OUTSIDE_SLOT');
 if(!Array.isArray(items)||items[reservation.interruptedIndex]?.asset?.id!==reservation.interruptedAssetId||
    items[reservation.targetIndex]?.asset?.id!==reservation.targetAssetId)return deny('PLAYLIST_CHANGED');
 let elapsed=nowMs-reservation.resumeAfterMs;
 for(let i=reservation.targetIndex;i<items.length;i++){
   const item=items[i],duration=item?.asset?.durationMs;
   if(!Number.isSafeInteger(duration)||duration<1000)return deny('INVALID_DURATION');
   if(elapsed<duration){
     return {ok:true,slotId:slot.id,index:i,assetId:item.asset.id,seekMs:elapsed,
       durationMs:duration,remainingMs:Math.min(duration-elapsed,reservation.slotEndMs-nowMs),
       untilMs:reservation.slotEndMs};
   }
   elapsed-=duration;
 }
 return deny('PLAYLIST_FINISHED');
}
