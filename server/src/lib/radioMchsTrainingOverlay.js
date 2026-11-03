/** Bounded-memory station PCM training overlay.
 * Plays a verified local ALARM asset to its natural end, with optional complete
 * repeats. It is not an event source and never authorizes public broadcasting.
 */
export const PCM_BYTES_PER_SECOND=48000*2*2;
export const MAX_TRAINING_REPEATS=5;
export function createTrainingOverlay({pcm,enabled=false}={}){
 let active=false,revision=0,source=pcm||null,position=0,lastStopReason=null;
 let startedAt=null,finishedAt=null,totalBytes=0,completedRepeats=0,repeats=1;
 let playedBytes=0;
 const close=()=>{const current=source;source=null;if(current&&typeof current.close==='function')current.close();};
 const stop=(reason='OPERATOR_STOP')=>{
  if(active){active=false;revision++;lastStopReason=reason;finishedAt=new Date().toISOString();close();}
  return snapshot();
 };
 function snapshot(){
  const targetBytes=totalBytes*repeats;
  return {enabled,active,revision,remainingBytes:active?Math.max(0,targetBytes-playedBytes):0,
   lastStopReason,startedAt,finishedAt,totalBytes:targetBytes,
   playedBytes,completedRepeats,repeats,
   output:active?'SHARED_STATION_ENCODER_TRAINING':'NORMAL_PROGRAM',realEmergencyReady:false};
 }
 function valid(s){
  return s&&Number.isSafeInteger(s.size)&&s.size>0&&s.size%4===0&&
   typeof s.read==='function'&&typeof s.close==='function';
 }
 const asSource=buf=>({size:buf.length,read:(pos,n)=>buf.subarray(pos,pos+n),close:()=>{}});
 const startWith=(sourcePcm,options={})=>{
  if(!enabled)return {ok:false,reason:'DISABLED',...snapshot()};
  if(active)return {ok:false,reason:'ALREADY_ACTIVE',...snapshot()};
  const requestedRepeats=options?.repeats??1;
  if(!Number.isInteger(requestedRepeats)||requestedRepeats<1||
     requestedRepeats>MAX_TRAINING_REPEATS)
   return {ok:false,reason:'INVALID_REPEATS',...snapshot()};
  const next=Buffer.isBuffer(sourcePcm)?asSource(sourcePcm):sourcePcm;
  if(!valid(next))return {ok:false,reason:'INVALID_PCM',...snapshot()};
  if(!Number.isSafeInteger(next.size*requestedRepeats))
   return {ok:false,reason:'PCM_TOO_LARGE',...snapshot()};
  source=next;position=0;totalBytes=next.size;completedRepeats=0;repeats=requestedRepeats;
  playedBytes=0;lastStopReason=null;startedAt=new Date().toISOString();
  finishedAt=null;active=true;revision++;
  return {ok:true,...snapshot()};
 };
 return {
  snapshot,startWith,
  start(options={}){return startWith(source,options);},
  stop:()=>({ok:true,...stop()}),
  replace(frame){
   if(!Buffer.isBuffer(frame)||frame.length%4!==0)throw new TypeError('INVALID_PCM_FRAME');
   if(!active)return frame;
   const result=Buffer.alloc(frame.length);
   let offset=0;
   try{
    while(active&&offset<frame.length){
     const n=Math.min(frame.length-offset,source.size-position);
     const data=source.read(position,n);
     if(!Buffer.isBuffer(data)||data.length!==n)throw new Error('READ_FAILED');
     data.copy(result,offset);
     offset+=n;position+=n;playedBytes+=n;
     if(position===source.size){
      completedRepeats++;position=0;
      if(completedRepeats===repeats)stop('FILE_COMPLETED');
     }
    }
   }catch{
    stop('SOURCE_READ_FAILED');
    // Never leak a partial/truncated alert frame into subsequent music.
    return Buffer.alloc(frame.length);
   }
   return result;
  }
 };
}
