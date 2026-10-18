/** Deterministic two-deck Auto-DJ timeline with an equal-duration overlap. */
export function crossfadePlan(assets,nowMs,requestedMs=0) {
  if (!Array.isArray(assets) || assets.length<2 || !assets.every(a=>a.playDurationMs>=1000)) return null;
  if(!Number.isSafeInteger(requestedMs)||requestedMs<250||requestedMs>5000)return null;
  // Every track must have an audible solo region; a common overlap keeps the clock deterministic.
  const overlapMs=Math.min(requestedMs,...assets.map(a=>Math.floor((a.playDurationMs-1000)/2)));
  if(overlapMs<250)return null;
  const segments=assets.map(a=>a.playDurationMs-overlapMs);
  const period=segments.reduce((a,b)=>a+b,0);
  if(period<=0)return null;
  let position=((nowMs%period)+period)%period;
  for(let index=0;index<assets.length;index++) {
    const current=assets[index],next=assets[(index+1)%assets.length];
    const soloDuration=current.playDurationMs-2*overlapMs;
    if(position<segments[index]){
      if(position<soloDuration)return {mode:'SOLO',track:current,index,
        seekMs:current.cue.inMs+overlapMs+position,
        remainingMs:soloDuration-position,overlapMs};
      const blendPosition=position-soloDuration;
      return {mode:'BLEND',track:current,next,index,
        seekMs:current.cue.outMs-overlapMs+blendPosition,
        nextSeekMs:next.cue.inMs+blendPosition,
        remainingMs:overlapMs-blendPosition,overlapMs,blendPosition};
    }
    position-=segments[index];
  }
  return null;
}

/** The overlap must not continue into a hard-start scheduled broadcast. */
export function withinBroadcastBoundary(remainingMs, nextBroadcastMs,nowMs){
  return Math.max(0,Math.min(remainingMs,nextBroadcastMs===null?Infinity:nextBroadcastMs-nowMs));
}
