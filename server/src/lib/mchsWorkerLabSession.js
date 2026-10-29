/** Isolated MCHS lab control plane; never touches station audio or hardware. */
export function createWorkerMchsLabSession({now=()=>Date.now(),ttlMs=120000}={}){
 let phase='IDLE',updated=now(),revision=0,commandAt=null,observedRevision=-1,observation=null;
 const snapshot=()=>({
  phase,revision,expiresInMs:phase==='IDLE'?0:Math.max(0,ttlMs-(now()-updated)),
  output:'ISOLATED_LAB_ONLY',
  // From control-command commit to first Worker PCM tick, NOT browser audibility.
  pcmObservation:observation
 });
 const change=(next)=>{
  phase=next;updated=now();revision++;commandAt=updated;observation=null;
 };
 function expire(){if(phase!=='IDLE'&&now()-updated>=ttlMs)change('IDLE');}
 return {
  status(){expire();return snapshot();},
  command(action){
   expire();
   const valid=(action==='START'&&phase==='IDLE')||
    (action==='INTERRUPT'&&phase==='PROGRAM')||
    (action==='RESUME'&&phase==='ALERT')||
    action==='STOP';
   if(!valid)return {ok:false,reason:'INVALID_TRANSITION',...snapshot()};
   change(action==='START'||action==='RESUME'?'PROGRAM':action==='INTERRUPT'?'ALERT':'IDLE');
   return {ok:true,...snapshot()};
  },
  observePcmTick(seenRevision){
   // Only first observed tick of latest command counts; no stream => no measurement.
   if(!Number.isInteger(seenRevision)||seenRevision!==revision||seenRevision===observedRevision||commandAt===null)return;
   observedRevision=seenRevision;
   observation={revision:seenRevision,phase,workerCommandToPcmTickMs:Math.max(0,now()-commandAt)};
  }
 };
}
