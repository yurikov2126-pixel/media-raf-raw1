/** Attribute generated two-deck PCM to both source assets without double-counting stream duration.
 * This is a server signal attribution, not proof of client reception.
 */
export function playbackAttributions({track,blend,generatedMs,startedAt,mode,slotId=null}){
  if(!Number.isFinite(generatedMs)||generatedMs<1000||!track?.id)return [];
  const common={mode,startedAt,slotId};
  const output=[{...common,id:track.id,name:track.name,generatedMs:Math.round(generatedMs),mixed:!!blend}];
  if(blend?.nextId && blend.nextId!==track.id){
    // During acrossfade both inputs contribute; log the second deck as well.
    output.push({...common,id:blend.nextId,name:blend.nextName||blend.nextId,
      generatedMs:Math.round(generatedMs),mixed:true});
  }
  return output;
}
