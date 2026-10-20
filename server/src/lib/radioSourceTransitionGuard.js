import {RadioHandoverController} from './radioHandoverController.js';
/** Gate every two-deck selection against the true worker source authority.
 * Only plan a crossfade for a fully identified target, not a pending schedule
 * guess or an AutoDJ playlist item that could have been reordered.
 */
export function validateSourceTransition({source,target,slotKnown,scheduledActive,publicLive=false,overlapMs=1500}={}){
 if(!source?.id||!target?.id||source.id===target.id)
  return {allowed:false,reason:'INVALID_SOURCE_PAIR'};
 if(slotKnown!==true)return {allowed:false,reason:'SCHEDULE_AUTHORITY_UNKNOWN'};
 if(publicLive)return {allowed:false,reason:'PUBLIC_LIVE_PRIORITY'};
 if(!Number.isSafeInteger(overlapMs)||overlapMs<250||overlapMs>5000)
  return {allowed:false,reason:'INVALID_OVERLAP'};
 const type=source.mode+'>'+target.mode;
 if(type!=='AUTO_DJ>SCHEDULED'&&type!=='SCHEDULED>AUTO_DJ')
  return {allowed:false,reason:'NOT_SOURCE_HANDOVER'};
 if(type==='AUTO_DJ>SCHEDULED'&&scheduledActive!==true)
  return {allowed:false,reason:'SCHEDULE_NOT_ACTIVE'};
 if(type==='SCHEDULED>AUTO_DJ'&&scheduledActive===true)
  return {allowed:false,reason:'SCHEDULE_STILL_ACTIVE'};
 return {allowed:true,type,overlapMs};
}
export function reserveSourceTransition({source,target,sourceReady,targetReady,publicLive=false,slotKnown=false,scheduledActive=false,overlapMs=1500}={}){
 const decision=validateSourceTransition({source,target,slotKnown,scheduledActive,publicLive,overlapMs});
 if(!decision.allowed)return {...decision,controller:null};
 const controller=new RadioHandoverController({overlapMs});
 const result=controller.reserve({source,target,sourceReady,targetReady,publicLive,slotAuthority:slotKnown});
 return {allowed:result.ok,reason:result.reason||null,controller,
   fallback:result.fallback||null,type:decision.type};
}
