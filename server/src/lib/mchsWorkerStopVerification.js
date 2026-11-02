/** Verify STOP of the actual Worker overlay, not merely HTTP 200 for a STOP command.
 * A transport error or missing state remains unconfirmed.
 */
export async function stopAndVerifyMchsWorker({request,attempts=3}={}){
 if(typeof request!=='function')return {confirmed:false,reason:'NO_WORKER_TRANSPORT'};
 let lastReason='STOP_UNCONFIRMED';
 for(let i=0;i<attempts;i++){
  try{
   const stop=await request('STOP');
   if(stop?.httpStatus!==200||stop?.data?.ok===false){
    lastReason='STOP_REJECTED';continue;
   }
   const state=await request();
   if(state?.httpStatus===200&&state?.data?.active===false)
    return {confirmed:true,reason:'WORKER_OVERLAY_INACTIVE',attempts:i+1};
   lastReason='OVERLAY_STILL_ACTIVE_OR_UNKNOWN';
  }catch{lastReason='WORKER_UNREACHABLE';}
 }
 return {confirmed:false,reason:lastReason,attempts};
}
