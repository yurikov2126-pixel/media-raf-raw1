// A playlist can contain a full Auto-DJ library. Bounded to keep DB operations predictable.
export const MAX_RADIO_PLAYLIST_TRACKS = 5000;
export const RADIO_PLAYLIST_WRITE_BATCH = 250;

export function validateRadioPlaylistTracks(assetIds){
 if(!Array.isArray(assetIds)||assetIds.length>MAX_RADIO_PLAYLIST_TRACKS||
   assetIds.some(id=>typeof id!=='string'||!id||id.length>120))
   return 'Допустимо не более '+MAX_RADIO_PLAYLIST_TRACKS+' корректных записей в плейлисте';
 if(new Set(assetIds).size!==assetIds.length)return 'В плейлисте есть повторяющиеся записи';
 return null;
}

export async function writeRadioPlaylistItems(tx,playlistId,assetIds,transitions=[]){
 for(let offset=0;offset<assetIds.length;offset+=RADIO_PLAYLIST_WRITE_BATCH){
  const batch=assetIds.slice(offset,offset+RADIO_PLAYLIST_WRITE_BATCH);
  await tx.radioPlaylistItem.createMany({
   data:batch.map((assetId,index)=>({playlistId,assetId,position:offset+index,transition:transitions[offset+index]||null})),
  });
 }
}
