import { chooseQueuedTrack } from './radioEventQueue.js';

/** Build a two-deck reservation without mutating playout history.
 * A selection is not evidence of audio having been generated.
 * Current asset is excluded even if it is otherwise eligible.
 */
export function reserveCrossfadePair(items, history, cooldownMinutes, nowMs=Date.now(), preferredId=null){
  const first=preferredId?items.find(item=>item.id===preferredId):chooseQueuedTrack(items,history,cooldownMinutes,nowMs);
  if(!first)return {status:'EMPTY',first:null,second:null};
  const available=items.filter(item=>item.id!==first.id);
  const second=chooseQueuedTrack(available,history,cooldownMinutes,nowMs);
  return {status:second?'READY':'SOLO',first,second};
}

/** A blend cannot exceed source cue spans or the next scheduled boundary. */
export function safeCrossfadeDuration(first,second,requestedMs,untilMs,nowMs=Date.now()){
  if(!first||!second||!Number.isInteger(requestedMs)||requestedMs<250||requestedMs>5000)return 0;
  const a=first.playDurationMs,b=second.playDurationMs;
  if(!Number.isFinite(a)||!Number.isFinite(b))return 0;
  const maximum=Math.min(requestedMs,Math.floor(a/2),Math.floor(b/2),untilMs-nowMs);
  return maximum>=250?maximum:0;
}
