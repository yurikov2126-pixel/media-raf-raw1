import {createMchsStationPrioritySession} from './mchsStationPrioritySession.js';

// Pure event-bound PCM source for the shared 48kHz stereo PCM16 encoder.
// It does not fetch Android data, issue commands, or control GPIO. A verified
// coordinator will be added in a separate stage. No public start route exists.
export function createMchsStationPcmExecutor({onTerminal=()=>{}}={}){
 const lifecycle=createMchsStationPrioritySession();
 let source=null,position=0,completedRepeats=0,bound=null;
 let pcmFrames=0,programFrames=0;
 const validSource=s=>s&&Number.isSafeInteger(s.size)&&s.size>0&&s.size%4===0&&
   typeof s.read==='function'&&typeof s.close==='function';
 const release=()=>{
  if(source){const ending=source;source=null;try{ending.close();}catch{}}
  position=0;
 };
 const snap=()=>({
  ...lifecycle.snapshot(),
  active:source!==null,
  pcmFrames,programFrames,
  acceptsAndroidEvents:false,
  hasLiveStartRoute:false,
  gpioControlEnabled:false
 });
 function prepare({eventId,eventType,assetId,repeats,pcm}={}){
  if(source)return {ok:false,reason:'ACTIVE_PCM_SOURCE'};
  if(!validSource(pcm))return {ok:false,reason:'INVALID_PCM_SOURCE'};
  if(!Number.isSafeInteger(pcm.size*repeats))
   return {ok:false,reason:'PCM_LENGTH_OVERFLOW'};
  const admitted=lifecycle.enter({eventId,eventType,assetId,repeats});
  if(!admitted.accepted)return {ok:false,reason:admitted.reason};
  source=pcm;bound={eventId,repeats};position=0;completedRepeats=0;
  pcmFrames=0;programFrames=0;
  return {ok:true,...snap()};
 }
 function replace(frame){
  if(!Buffer.isBuffer(frame)||frame.length%4!==0)
   throw new TypeError('INVALID_ENCODER_PCM_FRAME');
  if(!source)return frame;
  const output=Buffer.alloc(frame.length);
  let cursor=0;
  try{
   while(source&&cursor<output.length){
    const size=Math.min(output.length-cursor,source.size-position);
    const chunk=source.read(position,size);
    if(!Buffer.isBuffer(chunk)||chunk.length!==size)throw new Error('PCM_SOURCE_READ_FAILED');
    chunk.copy(output,cursor);
    if(lifecycle.snapshot().phase==='PREEMPTING')
     lifecycle.preempted({eventId:bound.eventId,sourceSuspended:true});
    cursor+=size;position+=size;
    if(position===source.size){
     completedRepeats++;position=0;
     if(completedRepeats===bound.repeats){
      // No extra audio is written past the end of the final alert frame.
      lifecycle.frameCompleted({eventId:bound.eventId,repeats:completedRepeats,
                                reason:'FILE_COMPLETED'});
      release();
     }
    }
   }
   pcmFrames++;
   return output;
  }catch{
   const failed=lifecycle.abort('PCM_SOURCE_READ_FAILED');
   if(failed.accepted)try{onTerminal({...lifecycle.snapshot().session,phase:'FAILED'});}catch{}
   release();
   return Buffer.alloc(frame.length);
  }
 }
 function observeProgram(frame){
  const state=lifecycle.snapshot();
  if(state.phase==='RESUMING'&&Buffer.isBuffer(frame)&&frame.length>0&&
      frame.some(byte=>byte!==0)){
   programFrames++;
   lifecycle.restored({eventId:state.session.eventId,programAudioConfirmed:true});
   try{onTerminal({...lifecycle.snapshot().session,phase:'COMPLETE'});}catch{}
  }
  return snap();
 }
 function abort(reason='ABORTED'){
  const accepted=lifecycle.abort(reason);
  if(accepted.accepted)try{onTerminal({...lifecycle.snapshot().session,phase:'FAILED'});}catch{}
  release();
  return snap();
 }
 return {prepare,replace,observeProgram,abort,snapshot:snap,
  terminalHistory:()=>lifecycle.history()};
}
