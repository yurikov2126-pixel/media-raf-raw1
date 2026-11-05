import {createMchsStationPrioritySession} from './mchsStationPrioritySession.js';

/**
 * Observe PCM frames already written into the station encoder.
 *
 * The Worker owns the real shared MP3 encoder; this adapter only reports
 * what its PCM entrypoint did. A START HTTP receipt cannot make PLAYING.
 * Natural completion must be reflected by the overlay's post-frame state.
 * Program return must be confirmed by a later non-silent *normal* PCM
 * frame written into the encoder (not by changing a boolean).
 *
 * This observer does not start/stop audio, trigger Android, or switch GPIO.
 */
export function createMchsWorkerPcmEvidence(){
 const session=createMchsStationPrioritySession();
 let bound=null;
 let acceptedFrames=0;
 let resumedFrames=0;
 let lastError=null;
 const fail=reason=>{
  lastError=reason;
  if(bound){
   session.abort(reason);
   bound=null;
  }
 };
 const nonSilent=buffer=>Buffer.isBuffer(buffer)&&buffer.length>0&&
   buffer.some(byte=>byte!==0);
 return {
  begin({eventId,eventType,assetId,repeats}={}){
   const result=session.enter({eventId,eventType,assetId,repeats});
   if(result.accepted){
    bound=eventId;acceptedFrames=0;resumedFrames=0;lastError=null;
   }
   return result;
  },
  observe({before,after,frame,output}={}){
   if(!bound)return session.snapshot();
   const id=bound;
   if(!Buffer.isBuffer(output)||output.length!==frame?.length||output.length%4!==0){
    fail('INVALID_ENCODER_FRAME');
    return session.snapshot();
   }
   const phase=session.snapshot().phase;
   if(phase==='PREEMPTING'&&before?.active===true){
    // Actual overlay read and PCM routed to the shared encoder.
    if(after?.playedBytes>before.playedBytes){
     session.preempted({eventId:id,sourceSuspended:true});
    }
   }
   const current=session.snapshot().phase;
   if(current==='PLAYING'){
    if(before?.active&&after?.playedBytes>before.playedBytes)acceptedFrames++;
    if(after?.active===false){
     if(after.lastStopReason==='FILE_COMPLETED'&&
        after.completedRepeats===after.repeats){
      session.frameCompleted({eventId:id,repeats:after.completedRepeats,
                              reason:'FILE_COMPLETED'});
     }else fail('PCM_OVERLAY_DID_NOT_COMPLETE');
    }
   }
   if(session.snapshot().phase==='RESUMING'&&
      before?.active===false&&after?.active===false&&
      acceptedFrames>0&&nonSilent(output)){
    resumedFrames++;
    session.restored({eventId:id,programAudioConfirmed:true});
    bound=null;
   }
   return session.snapshot();
  },
  abort(reason='WORKER_ABORT'){fail(reason);return session.snapshot();},
  snapshot(){
   return {...session.snapshot(),acceptedFrames,resumedFrames,lastError,
     evidenceOnly:true,mainAirCommandEnabled:false};
  }
 };
}
