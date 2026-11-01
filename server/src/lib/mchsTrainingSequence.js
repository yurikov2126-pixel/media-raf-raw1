import {planAlarmSequence,normalizeDangerRepeats} from './mchsAlarmRepeats.js';
/** Explicit operator-run training sequence on existing PCM training overlay.
 * Always stops on failure; never runs from MCHS events.
 */
export async function runTrainingSequence({dangerAssetId,clearAssetId,request,signal,onProgress=()=>{},pollMs=500,maxWaitMs=300000,dangerRepeats=1}={}){
 if(!dangerAssetId||!clearAssetId||dangerAssetId===clearAssetId||typeof request!=='function')
  return {ok:false,reason:'INVALID_TRAINING_ASSETS'};
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 let started=false;
 try{
  const initial=await request();
  if(initial.httpStatus!==200||initial.data?.active)return {ok:false,reason:'WORKER_BUSY'};
  for(const {stage,assetId,repetition,total} of planAlarmSequence({dangerAssetId,clearAssetId,dangerRepeats:normalizeDangerRepeats(dangerRepeats)})){
   if(signal?.aborted)throw new Error('CANCELLED');
   onProgress({stage,status:'STARTING',repetition,total});
   const start=await request('START',assetId);
   if(start.httpStatus!==200||!start.data?.ok)throw new Error('START_FAILED_'+stage);
   started=true;
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
    if(status.httpStatus!==200){onProgress({stage,status:'RETRYING_WORKER_STATUS',reason:'HTTP_'+status.httpStatus});continue;}
    if(!status.data?.active){
     if(status.data?.lastStopReason!=='FILE_COMPLETED')throw new Error('ABORTED_'+stage);
     finished=true;break;
    }
   }
   if(!finished)throw new Error('TIMEOUT_'+stage);
   started=false;
   onProgress({stage,status:'COMPLETED',repetition,total});
  }
  return {ok:true,reason:'SEQUENCE_COMPLETED',normalProgramExpected:true};
 }catch(error){
  if(started)try{await request('STOP');}catch{}
  return {ok:false,reason:error.message||'SEQUENCE_FAILED',normalProgramExpected:true};
 }
}
