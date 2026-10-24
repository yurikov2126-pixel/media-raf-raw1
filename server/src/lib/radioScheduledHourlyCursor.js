/**
 * Immutable, bounded post-announcement scheduled cursor reservation.
 * Skips the interrupted song, never alters approved slot start/end, and
 * invalidates if playlist identity or next item changed.
 */
export function reserveScheduledHourlySuccessor({slot,items,interruptedIndex,nowMs,announcementMs}){
 const deny=reason=>({ok:false,reason});
 if(!slot?.id||!slot.playlistId||!Number.isFinite(Date.parse(slot.endAt)))return deny('INVALID_SLOT');
 if(!Array.isArray(items)||!Number.isInteger(interruptedIndex)||interruptedIndex<0||interruptedIndex>=items.length)return deny('INVALID_POSITION');
 if(!Number.isFinite(nowMs)||!Number.isFinite(announcementMs)||announcementMs<0)return deny('INVALID_CLOCK');
 const target=items[interruptedIndex+1];
 if(!target?.asset?.id)return deny('NO_SUCCESSOR');
 const deadline=Date.parse(slot.endAt);
 if(nowMs+announcementMs+500>=deadline)return deny('INSUFFICIENT_WINDOW');
 return {ok:true,slotId:slot.id,playlistId:slot.playlistId,interruptedIndex,
  interruptedAssetId:items[interruptedIndex].asset?.id,
  targetIndex:interruptedIndex+1,targetAssetId:target.asset.id,
  slotEndMs:deadline,resumeAfterMs:nowMs+announcementMs};
}
export function resolveScheduledHourlySuccessor(reservation,{slot,items,nowMs,live=false}={}){
 const deny=reason=>({ok:false,reason});
 if(!reservation?.ok)return deny('NO_RESERVATION');
 if(live)return deny('LIVE_PRIORITY');
 if(!slot||slot.id!==reservation.slotId||slot.playlistId!==reservation.playlistId)return deny('SLOT_CHANGED');
 if(!Number.isFinite(nowMs)||nowMs<reservation.resumeAfterMs||nowMs>=reservation.slotEndMs||Date.parse(slot.endAt)!==reservation.slotEndMs)return deny('OUTSIDE_SLOT');
 if(items?.[reservation.interruptedIndex]?.asset?.id!==reservation.interruptedAssetId||
  items?.[reservation.targetIndex]?.asset?.id!==reservation.targetAssetId)return deny('PLAYLIST_CHANGED');
 return {ok:true,slotId:reservation.slotId,index:reservation.targetIndex,
  assetId:reservation.targetAssetId,seekMs:0,untilMs:reservation.slotEndMs};
}
