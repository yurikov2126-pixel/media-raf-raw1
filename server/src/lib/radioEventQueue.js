/** Choose the next whole track only after the previous decoder finishes.
 * Order is deterministic among equally eligible items; use real playout history.
 * If every asset is inside cooldown, return null rather than violating a hard ban.
 */
export function chooseQueuedTrack(items,history,minutes,nowMs=Date.now()){
  if(!Array.isArray(items)||!items.length)return null;
  const cutoff=nowMs-minutes*60000;
  const last=new Map();
  for(const event of history){
    const time=Date.parse(event.startedAt);
    if(Number.isFinite(time)&&time<=nowMs&&time>0)
      last.set(event.id,Math.max(last.get(event.id)||0,time));
  }
  const eligible=items.filter(item=>!minutes||(last.get(item.id)||0)<=cutoff);
  if(!eligible.length)return null;
  // The least recently aired eligible item wins; stable order breaks ties.
  return eligible.reduce((best,item)=>{
    if(!best)return item;
    return (last.get(item.id)||0)<(last.get(best.id)||0)?item:best;
  },null);
}
