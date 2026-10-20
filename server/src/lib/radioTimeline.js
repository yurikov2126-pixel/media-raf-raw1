/**
 * Resolve a deterministic position in the Moscow-scheduled station timeline.
 * Input timestamps are absolute instants (UTC); Moscow is only the editor's display timezone.
 * Returns no audio bytes. Safe for all authorized agents to use as a clock reference.
 */
export function resolveRadioCursor(slots, nowMs = Date.now(), {scheduledCrossfade=false,defaultScheduledOverlapMs=0} = {}) {
  const now = Number(nowMs);
  if (!Number.isFinite(now)) throw new TypeError('Invalid station clock');
  const slot = slots.find(item => {
    const start = new Date(item.startAt).getTime();
    const end = new Date(item.endAt).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end;
  });
  if (!slot) return { status: 'IDLE', at: new Date(now).toISOString(), slot: null, track: null };
  const offsetMs = Math.max(0, now - new Date(slot.startAt).getTime());
  if(scheduledCrossfade){
    const items=slot.playlist.items;
    const overlapFor=index=>{
      const current=items[index],next=items[index+1];
      if(!next)return 0;
      const transition=current.transition;
      // Explicit cut always wins. Unconfigured tracks may use station-wide default.
      const configured=transition?.mode==='crossfade'?transition.overlapMs:
        transition?.mode==='cut'?0:defaultScheduledOverlapMs;
      const limit=Math.floor(Math.min(current.asset.durationMs,next.asset.durationMs)/2);
      return Number.isSafeInteger(configured)&&configured>=250&&configured<=15000&&configured<=limit
        ?configured:0;
    };
    let start=0;
    for(let index=0;index<items.length;index++){
      const current=items[index],length=current.asset.durationMs;
      if(!Number.isSafeInteger(length)||length<=0)throw new TypeError('Invalid track duration');
      const next=items[index+1];
      const transition=current.transition;
      const overlap=overlapFor(index);
      const entry=index>0?overlapFor(index-1):0;
      const span=length-entry-overlap;
      const blendAt=start+span;
      const end=blendAt+overlap;
      const meta={id:slot.id,playlistId:slot.playlistId,name:slot.playlist.name,
        startAt:new Date(slot.startAt).toISOString(),endAt:new Date(slot.endAt).toISOString()};
      if(offsetMs<blendAt){
        return {status:'SCHEDULED',at:new Date(now).toISOString(),slot:meta,
          track:{id:current.asset.id,name:current.asset.name,offsetMs:entry+offsetMs-start,
            durationMs:length,index,remainingMs:blendAt-offsetMs}};
      }
      if(overlap&&offsetMs<end){
        const blendPosition=offsetMs-blendAt;
        return {status:'SCHEDULED',at:new Date(now).toISOString(),slot:meta,
          track:{id:current.asset.id,name:current.asset.name,index,durationMs:length,
            offsetMs:length-overlap+blendPosition,seekMs:length-overlap+blendPosition,
            remainingMs:overlap-blendPosition,
            blend:{nextId:next.asset.id,nextName:next.asset.name,
              nextStorageKey:next.asset.storageKey,overlapMs:overlap,
              nextSeekMs:blendPosition,blendPosition,curve:transition.curve||'equalPower'}}};
      }
      start=end;
    }
    return {status:'IDLE',at:new Date(now).toISOString(),
      slot:{id:slot.id,playlistId:slot.playlistId,name:slot.playlist.name,
        startAt:new Date(slot.startAt).toISOString(),endAt:new Date(slot.endAt).toISOString()},track:null};
  }

  let consumedMs = 0;
  for (const item of slot.playlist.items) {
    const length = item.asset.durationMs;
    if (!Number.isSafeInteger(length) || length <= 0) throw new TypeError('Invalid track duration');
    if (offsetMs < consumedMs + length) return {
      status: 'SCHEDULED',
      at: new Date(now).toISOString(),
      slot: { id: slot.id, playlistId: slot.playlistId, name: slot.playlist.name,
        startAt: new Date(slot.startAt).toISOString(), endAt: new Date(slot.endAt).toISOString() },
      track: { id: item.asset.id, name: item.asset.name,
        offsetMs: offsetMs - consumedMs, durationMs: length, index: slot.playlist.items.indexOf(item) },
    };
    consumedMs += length;
  }
  // A deliberately unfilled tail never loops the playlist or silently resets it.
  return { status: 'IDLE', at: new Date(now).toISOString(),
    slot: { id: slot.id, playlistId: slot.playlistId, name: slot.playlist.name,
      startAt: new Date(slot.startAt).toISOString(), endAt: new Date(slot.endAt).toISOString() },
    track: null };
}
