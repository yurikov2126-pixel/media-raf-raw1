/** Validation for editable, non-broadcast AutoPlaylist snapshots. */
export function validateAutoPlaylistDraft(items,assets,{maxItems=500}={}){
 if(!Array.isArray(items)||items.length>maxItems)throw new RangeError('Некорректное количество записей');
 const byId=new Map(assets.map(a=>[a.id,a]));
 let elapsed=0;
 const normalized=items.map((item,i)=>{
  if(!item||typeof item.assetId!=='string'||!['MUSIC','JINGLE'].includes(item.kind)||
    typeof item.pinned!=='boolean'||!Number.isInteger(item.fadeMs)||item.fadeMs<0||item.fadeMs>8000)
   throw new RangeError('Некорректная запись '+(i+1));
  const asset=byId.get(item.assetId);
  if(!asset||!Number.isFinite(asset.durationMs)||asset.durationMs<=0)
   throw new RangeError('Аудиофайл отсутствует: '+item.assetId);
  const fade=i===0||item.kind==='JINGLE'||items[i-1].kind==='JINGLE'?0:
   Math.min(item.fadeMs,asset.durationMs/2,byId.get(items[i-1].assetId)?.durationMs/2||0);
  elapsed+=asset.durationMs-fade;
  return {assetId:item.assetId,kind:item.kind,pinned:item.pinned,fadeMs:fade,durationMs:asset.durationMs};
 });
 return {items:normalized,durationMs:Math.round(elapsed)};
}
