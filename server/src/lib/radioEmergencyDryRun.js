import {planEmergencyTransition,emergencyWatchdog} from './radioEmergencyTransitionPlan.js';
const SOURCES=new Set(['AUTO_DJ','SCHEDULE','LIVE','MANUAL_PLAYLIST','AUTO_PLAYLIST','UNKNOWN']);
export function createEmergencyDryRun({now=()=>Date.now(),maxEntries=100}={}){
 let current={phase:'IDLE',requestId:null,updatedAtMs:now()};
 const history=[];
 const append=(entry)=>{history.push(entry);if(history.length>maxEntries)history.shift();};
 const safeState=()=>({phase:current.phase,requestId:current.requestId,updatedAtMs:current.updatedAtMs});
 return {
  snapshot(){return {mode:'DRY_RUN_ONLY',state:safeState(),history:history.slice(),watchdog:emergencyWatchdog(current,now())};},
  run(request,context={}){
   const source=SOURCES.has(context.source)?context.source:'UNKNOWN';
   const result=planEmergencyTransition(current,request,{
     emergencyFeatureEnabled:true,
     trustedControlPlane:context.trustedControlPlane===true,
     operatorAuthorized:context.operatorAuthorized===true,
     audioAssetReady:context.audioAssetReady===true,
     outputChainVerified:context.outputChainVerified===true,
     emergencyAudioStopped:context.emergencyAudioStopped===true,
     programResumed:context.programResumed===true
   });
   const at=now();
   append({at:new Date(at).toISOString(),source,action:String(request?.type||'UNKNOWN'),
     requestId:String(request?.requestId||'').slice(0,120),
     from:current.phase,to:result.state,accepted:result.accepted,
     reason:result.reason,plannedEffects:result.effects});
   if(result.accepted)current={phase:result.state,requestId:result.state==='IDLE'?null:result.requestId,updatedAtMs:at};
   return {...result,source,simulationOnly:true,playbackChanged:false};
  }
 };
}
