/** Runtime jingle policy: a finished music decoder is the only clock tick.
 * Unlike a time-based rotation, strict queue supports inserting whole jingles.
 */
export function shouldInsertJingle({settings,daypart,completedMusic,untilMs,nowMs=Date.now()}){
 return !!settings?.enabled && settings.dayparts?.includes(daypart) &&
  settings.assetIds?.length>0 && Number.isInteger(completedMusic) && completedMusic>0 &&
  completedMusic%settings.everyTracks===0 && untilMs-nowMs>=settings.maxDurationMs+500;
}
export function chooseJingleAsset(settings,assets,sequence=0){
 const valid=new Map(assets.filter(a=>a.durationMs>=1000&&a.durationMs<=settings.maxDurationMs).map(a=>[a.id,a]));
 const ordered=settings.assetIds.map(id=>valid.get(id)).filter(Boolean);
 return ordered.length?ordered[sequence%ordered.length]:null;
}
