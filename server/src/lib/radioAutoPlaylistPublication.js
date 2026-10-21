import {validateAutoPlaylistDraft} from './radioAutoPlaylistDraft.js';
import {validatePlaylistTransitions,validateTransitionSpans,scheduledPlaylistDuration} from './radioPlaylistTransitions.js';

/** Turn saved incoming fade settings into outgoing transitions for the radio worker.
 * Preserve duplicate occurrences: radio playlist items are indexed by position.
 */
export function prepareAutoPlaylistPublication(draft,assets){
 const {items}=validateAutoPlaylistDraft(draft,assets);
 if(!items.length)throw new RangeError('Сначала сохраните непустой черновик');
 const assetIds=items.map(x=>x.assetId);
 const transitions=items.slice(0,-1).map((source,index)=>{
  const target=items[index+1];
  const fade=source.kind==='MUSIC'&&target.kind==='MUSIC'?target.fadeMs:0;
  return {mode:fade>=250?'crossfade':'cut',overlapMs:fade>=250?fade:0,curve:'sCurve'};
 });
 const validated=validatePlaylistTransitions(assetIds,transitions);
 const lengths=new Map(assets.map(x=>[x.id,x.durationMs]));
 const spans=assetIds.map((id,index)=>({durationMs:lengths.get(id),
  transition:validated[index]}));
 validateTransitionSpans(spans);
 const durationMs=scheduledPlaylistDuration(spans);
 if(durationMs>12*3600000)throw new RangeError('Плейлист длиннее 12 часов');
 return {assetIds,transitions:validated,durationMs};
}
