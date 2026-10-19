import {chooseQueuedTrack,selectExhaustionFallback} from './radioEventQueue.js';
import {rotationPlan,id3Artist} from './radioRotation.js';
import {cueAssets} from './radioAudioCue.js';
/** Read-only planning. Does not mutate history or promise that a track aired. */
export function previewMusicQueue({assets,settings,history=[],nowMs=Date.now(),limit=10}){
 const catalog=cueAssets(assets,settings.cues||{});
 const rotation=rotationPlan(catalog,settings.rotation,nowMs);
 if(!rotation)return {mode:'DISABLED',tracks:[],daypart:null};
 const items=rotation.items;
 const strict=settings.rotation.strictCooldown&&settings.rotation.cooldownMinutes>0;
 const visited=new Set(),tracks=[],shadowHistory=[...history];
 for(let step=0;step<Math.min(limit,items.length);step++){
  let candidate;
  if(strict){
   candidate=chooseQueuedTrack(items.filter(x=>!visited.has(x.id)),shadowHistory,
    settings.rotation.cooldownMinutes,nowMs+step*60000);
   if(!candidate&&settings.rotation.allowCooldownFallback)
    candidate=selectExhaustionFallback(items.filter(x=>!visited.has(x.id)),
      shadowHistory,nowMs+step*60000,true);
  } else candidate=items.find(x=>!visited.has(x.id));
  if(!candidate)break;
  visited.add(candidate.id);
  tracks.push({id:candidate.id,name:candidate.name,artist:id3Artist(candidate),
    durationMs:candidate.playDurationMs});
  shadowHistory.push({id:candidate.id,startedAt:new Date(nowMs+step*60000).toISOString(),mode:'AUTO_DJ'});
 }
 return {mode:strict?'STRICT':'ROTATION',daypart:rotation.daypart,tracks,
  disclaimer:'План приблизительный, не живое бронирование треков'};
}
