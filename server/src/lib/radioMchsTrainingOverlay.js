/** Bounded-memory shared station PCM training override, manual and off by default.
 * Audio duration is determined by the selected ALARM file, not a time limit.
 */
export const PCM_BYTES_PER_SECOND=48000*2*2;
export function createTrainingOverlay({pcm,enabled=false}={}){
 let active=false,revision=0,source=pcm||null,position=0,lastStopReason=null,startedAt=null,finishedAt=null,totalBytes=0;
 const close=()=>{if(source&&typeof source.close==='function')source.close();source=null;};
 const stop=(reason='OPERATOR_STOP')=>{
  if(active){active=false;revision++;lastStopReason=reason;finishedAt=new Date().toISOString();close();}
  return snapshot();
 };
 function snapshot(){return {enabled,active,revision,remainingBytes:active?Math.max(0,source.size-position):0,
  lastStopReason,startedAt,finishedAt,totalBytes,playedBytes:active?position:totalBytes,output:active?'SHARED_STATION_ENCODER_TRAINING':'NORMAL_PROGRAM',realEmergencyReady:false};}
 function valid(s){return s&&Number.isSafeInteger(s.size)&&s.size>0&&s.size%4===0&&typeof s.read==='function'&&typeof s.close==='function';}
 const asSource=(buf)=>({size:buf.length,read:(pos,n)=>buf.subarray(pos,pos+n),close:()=>{}});
 return {
  snapshot,
  startWith(sourcePcm){
   if(!enabled)return {ok:false,reason:'DISABLED',...snapshot()};
   if(active)return {ok:false,reason:'ALREADY_ACTIVE',...snapshot()};
   const next=Buffer.isBuffer(sourcePcm)?asSource(sourcePcm):sourcePcm;
   if(!valid(next))return {ok:false,reason:'INVALID_PCM',...snapshot()};
   source=next;position=0;totalBytes=next.size;lastStopReason=null;startedAt=new Date().toISOString();finishedAt=null;active=true;revision++;
   return {ok:true,...snapshot()};
  },
  start(){return this.startWith(source);},
  stop:()=>({ok:true,...stop()}),
  replace(frame){
   if(!Buffer.isBuffer(frame)||frame.length%4!==0)throw new TypeError('INVALID_PCM_FRAME');
   if(!active)return frame;
   const result=Buffer.alloc(frame.length);
   try{
    const n=Math.min(frame.length,source.size-position);
    const data=source.read(position,n);
    if(!Buffer.isBuffer(data)||data.length!==n)throw new Error('READ_FAILED');
    data.copy(result,0);
    position+=n;
    if(position>=source.size)stop('FILE_COMPLETED');
   }catch{stop('SOURCE_READ_FAILED');return Buffer.alloc(frame.length);}
   return result;
  }
 };
}
