/** Preserve the cursor of the first scheduled asset after an early overlap.
 * The station wall clock stays authoritative and cannot be moved by prewarming.
 */
export function resumeScheduledCursor(cursor,{slotId,assetId,consumedFrames}={}){
 if(!cursor||cursor.status!=='SCHEDULED'||cursor.slot?.id!==slotId||
   cursor.track?.index!==0||cursor.track?.id!==assetId)return cursor;
 if(!Number.isSafeInteger(consumedFrames)||consumedFrames<=0)return cursor;
 const seekMs=consumedFrames/48;
 const offset=Math.max(cursor.track.offsetMs||0,seekMs);
 if(offset>=cursor.track.durationMs)return {...cursor,track:null,status:'IDLE'};
 return {...cursor,track:{...cursor.track,offsetMs:offset,seekMs:offset,
  remainingMs:cursor.track.durationMs-offset}};
}
/** Transfer the unread PCM already buffered by a consumed decoder iterator.
 * Recreating the iterator or seeking to zero would replay target audio.
 */
export async function* continuePcmIterator(iterator){
 if(!iterator||typeof iterator.next!=='function')throw new TypeError('Invalid decoder iterator');
 if(iterator._radioRest?.length){
  yield iterator._radioRest;
  iterator._radioRest=Buffer.alloc(0);
 }
 while(true){
  const item=await iterator.next();
  if(item.done)break;
  yield item.value;
 }
}
