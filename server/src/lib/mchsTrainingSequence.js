import {stopAndVerifyMchsWorker} from './mchsWorkerStopVerification.js';
import {normalizeDangerRepeats} from './mchsAlarmRepeats.js';

/** Manual educational sequence on an explicitly enabled Worker overlay.
 * One START per asset, with all repeats played to the natural PCM end.
 * This is not connected to live Android events or automatic public dispatch.
 */
export async function runTrainingSequence({
 dangerAssetId,clearAssetId,request,signal,onProgress=()=>{},
 pollMs=500,maxWaitMs=300000,dangerRepeats=1
}={}){
 if(!dangerAssetId||!clearAssetId||dangerAssetId===clearAssetId||typeof request!=='function')
  return {ok:false,reason:'INVALID_TRAINING_ASSETS'};
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const sequence=[
  {stage:'DANGER',assetId:dangerAssetId,repeats:normalizeDangerRepeats(dangerRepeats)},
  {stage:'ALL_CLEAR',assetId:clearAssetId,repeats:1}
 ];
 let started=false;
 try{
  const initial=await request();
  if(initial.httpStatus!==200||initial.data?.active)return {ok:false,reason:'WORKER_BUSY'};
  for(const {stage,assetId,repeats} of sequence){
   if(signal?.aborted)throw new Error('CANCELLED');
   onProgress({stage,status:'STARTING',repetition:1,total:repeats});
   const start=await request('START',assetId,repeats);
   if(start.httpStatus!==200||!start.data?.ok)throw new Error('START_FAILED_'+stage);
   started=true;
   const revision=start.data.revision;
   const deadline=Date.now()+maxWaitMs;
   let finished=false;
   while(Date.now()<deadline){
    if(signal?.aborted)throw new Error('CANCELLED');
    await sleep(pollMs);
    let status;
    try{status=await request();}catch(error){
     if(signal?.aborted)throw new Error('CANCELLED');
     onProgress({stage,status:'RETRYING_WORKER_STATUS',reason:error?.message||'NETWORK_ERROR'});
     continue;
    }
    if(status.httpStatus!==200){
     onProgress({stage,status:'RETRYING_WORKER_STATUS',reason:'HTTP_'+status.httpStatus});
     continue;
    }
    // Once an event has started, all subsequent snapshots must reference that
    // event revision (or its natural completion revision).
    if(Number.isInteger(revision)&&Number.isInteger(status.data?.revision)&&
       ![revision,revision+1].includes(status.data.revision))
      throw new Error('WORKER_SESSION_CHANGED_'+stage);
    if(!status.data?.active){
     if(status.data?.lastStopReason!=='FILE_COMPLETED')throw new Error('ABORTED_'+stage);
     if(Number.isInteger(status.data?.completedRepeats)&&status.data.completedRepeats!==repeats)
      throw new Error('INCOMPLETE_REPEATS_'+stage);
     finished=true;break;
    }
    if(Number.isInteger(status.data?.completedRepeats))
     onProgress({stage,status:'PLAYING',repetition:status.data.completedRepeats,total:repeats});
   }
   if(!finished)throw new Error('TIMEOUT_'+stage);
   started=false;
   onProgress({stage,status:'COMPLETED',repetition:repeats,total:repeats});
  }
  return {ok:true,reason:'SEQUENCE_COMPLETED',normalProgramExpected:true};
 }catch(error){
  const stop=started?await stopAndVerifyMchsWorker({request}):null;
  return {ok:false,reason:error.message||'SEQUENCE_FAILED',normalProgramExpected:stop?.confirmed===true,
   stopConfirmed:stop?.confirmed??null,stopReason:stop?.reason||null};
 }
}
