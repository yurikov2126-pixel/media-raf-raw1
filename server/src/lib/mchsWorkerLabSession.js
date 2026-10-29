/** Isolated MCHS lab server-side session state. No station IO or audio output. */
export function createWorkerMchsLabSession({now=()=>Date.now(),ttlMs=120000}={}){
 let phase='IDLE',updated=now(),revision=0;
 const snapshot=()=>({phase,revision,expiresInMs:phase==='IDLE'?0:Math.max(0,ttlMs-(now()-updated)),output:'ISOLATED_LAB_ONLY'});
 function expire(){if(phase!=='IDLE'&&now()-updated>=ttlMs){phase='IDLE';revision++;}}
 return {
  status(){expire();return snapshot();},
  command(action){
   expire();
   const valid=action==='START'&&phase==='IDLE'||action==='INTERRUPT'&&phase==='PROGRAM'||action==='RESUME'&&phase==='ALERT'||action==='STOP';
   if(!valid)return {ok:false,reason:'INVALID_TRANSITION',...snapshot()};
   phase=action==='START'||action==='RESUME'?'PROGRAM':action==='INTERRUPT'?'ALERT':'IDLE';
   updated=now();revision++;
   return {ok:true,...snapshot()};
  }
 };
}
