// Transition belongs to the source track and its immediate next neighbor.
// It is never applied to the final track or across a scheduled show boundary.
export const DEFAULT_TRANSITION=Object.freeze({mode:'cut',overlapMs:0,curve:'equalPower'});
export const TRANSITION_CURVES=['equalPower','linear','sCurve'];
export function validatePlaylistTransitions(assetIds,transitions=[]){
 if(!Array.isArray(transitions)||transitions.length>Math.max(0,assetIds.length-1))
  throw new TypeError('Некорректное число переходов');
 return assetIds.slice(0,-1).map((id,index)=>{
  const value=transitions[index]||DEFAULT_TRANSITION;
  if(!value||!['cut','crossfade'].includes(value.mode)||
     !TRANSITION_CURVES.includes(value.curve)||
     !Number.isSafeInteger(value.overlapMs)||value.overlapMs<0||value.overlapMs>15000)
   throw new TypeError('Некорректные параметры перехода '+(index+1));
  const overlapMs=value.mode==='crossfade'?value.overlapMs:0;
  if(value.mode==='crossfade'&&overlapMs<250)
   throw new TypeError('Наложение должно быть от 250 мс');
  return {mode:overlapMs?'crossfade':'cut',overlapMs,curve:value.curve};
 });
}
export function scheduledPlaylistDuration(items){
 if(!items.length)return 0;
 let total=0;
 for(let i=0;i<items.length;i++){
  const duration=items[i].asset?.durationMs??items[i].durationMs;
  if(!Number.isSafeInteger(duration)||duration<=0)throw new TypeError('Нет длительности записи');
  total+=duration;
  if(i<items.length-1){
   const overlap=items[i].transition?.overlapMs||0;
   const next=items[i+1].asset?.durationMs??items[i+1].durationMs;
   if(overlap>Math.floor(Math.min(duration,next)/2))
    throw new TypeError('Слишком длинный переход между короткими записями');
   total-=overlap;
  }
 }
 return total;
}
export function transitionMapByPair(items){
 const map=new Map();
 for(let i=0;i<items.length-1;i++){
  const transition=items[i].transition||DEFAULT_TRANSITION;
  map.set(items[i].assetId+'|'+items[i+1].assetId,transition);
 }
 return map;
}
