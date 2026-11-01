import {classifyAutomaticAlarmCandidate} from './mchsAutomaticAlarmCandidate.js';
/** Read-only evidence pairing; time proximity is not dispatch authentication. */
export function correlateMissileBulletins(observations=[],bulletins=[],{nowMs=Date.now(),windowMs=90000}={}){
 const used=new Set();
 return observations.map(event=>{
  const candidate=classifyAutomaticAlarmCandidate(event,{nowMs});
  const base={eventId:event.id||null,eventType:candidate.eventType,sourceEventId:event.sourceEventId||null,
   receivedAt:event.receivedAt||null,automaticPlaybackEnabled:false,dispatchAuthorized:false};
  if(!candidate.accepted)return {...base,status:'REJECTED',reason:candidate.reason,bulletin:null};
  const time=Date.parse(event.occurredAt||'');
  const options=bulletins.filter(post=>post.eventType===candidate.eventType&&post.fresh&&
   Number.isFinite(Date.parse(post.publishedAt))&&Math.abs(Date.parse(post.publishedAt)-time)<=windowMs)
   .sort((a,b)=>Math.abs(Date.parse(a.publishedAt)-time)-Math.abs(Date.parse(b.publishedAt)-time));
  const found=options.find(post=>!used.has(post.postId));
  if(!found)return {...base,status:'UNMATCHED',reason:'NO_RECENT_PUBLIC_BULLETIN',bulletin:null};
  used.add(found.postId);
  return {...base,status:'PUBLICATION_CORROBORATED',reason:'PUBLIC_POST_NOT_AUTHENTICATED_DISPATCH',
   bulletin:{postId:found.postId,url:found.sourceUrl,publishedAt:found.publishedAt}};
 });
}
