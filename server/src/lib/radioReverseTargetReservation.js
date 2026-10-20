/** Pin a post-schedule AutoDJ selection without advancing rotation or journaling.
 * A reserved candidate must be revalidated against the live configuration.
 */
export function reserveReverseTarget({asset,playlistId,slotId,slotEndMs,seekMs,durationMs,nowMs}={}){
 if(!asset?.id||!playlistId||!slotId||!Number.isSafeInteger(slotEndMs)||
  !Number.isSafeInteger(nowMs)||slotEndMs<=nowMs||
  !Number.isSafeInteger(seekMs)||seekMs<0||
  !Number.isFinite(durationMs)||durationMs<2000)
  return null;
 return Object.freeze({assetId:asset.id,playlistId,slotId,slotEndMs,
  seekMs,durationMs,createdAtMs:nowMs});
}
export function validateReverseTarget(reservation,{
 nowMs,slotId,slotEndMs,playlistId,assetIds=[],autoDjEnabled=false,publicLive=false
}={}){
 if(!reservation)return {valid:false,reason:'NOT_RESERVED'};
 if(publicLive)return {valid:false,reason:'PUBLIC_LIVE'};
 if(!autoDjEnabled)return {valid:false,reason:'AUTO_DJ_DISABLED'};
 if(reservation.slotId!==slotId||reservation.slotEndMs!==slotEndMs)
  return {valid:false,reason:'SLOT_CHANGED'};
 if(reservation.playlistId!==playlistId||!assetIds.includes(reservation.assetId))
  return {valid:false,reason:'PLAYLIST_CHANGED'};
 if(!Number.isFinite(nowMs)||nowMs<reservation.createdAtMs||
   nowMs>reservation.slotEndMs+5000)
  return {valid:false,reason:'EXPIRED'};
 return {valid:true,assetId:reservation.assetId,seekMs:reservation.seekMs,
  durationMs:reservation.durationMs};
}
