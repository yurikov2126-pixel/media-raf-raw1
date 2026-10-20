import {RadioSourcePcmOverlap} from './radioSourcePcmOverlap.js';

/** Read exactly the PCM frames needed from an already-warmed decoder.
 * Never accept an unbounded buffer or fabricate samples on decoder EOF.
 */
export async function readPcmFrames(iterator,frames,{maxBufferedFrames=240000,deadlineMs=1500}={}){
 if(!iterator||typeof iterator.next!=='function'||!Number.isSafeInteger(frames)||frames<0)
  throw new TypeError('Invalid PCM reader');
 if(!Number.isSafeInteger(maxBufferedFrames)||maxBufferedFrames<frames)
  throw new RangeError('Insufficient buffer bound');
 if(!Number.isSafeInteger(deadlineMs)||deadlineMs<20||deadlineMs>15000)
  throw new RangeError('Invalid decoder deadline');
 const wanted=frames*4;
 if(!iterator._radioRest)iterator._radioRest=Buffer.alloc(0);
 const pieces=[];let total=0;
 const started=Date.now();
 while(total<wanted){
  let next=iterator._radioRest;iterator._radioRest=Buffer.alloc(0);
  if(!next.length){
   const left=Math.max(0,deadlineMs-(Date.now()-started));
   if(!left)throw new Error('TARGET_PCM_TIMEOUT');
   let timer;
   const result=await Promise.race([iterator.next(),new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error('TARGET_PCM_TIMEOUT')),left);
   })]).finally(()=>clearTimeout(timer));
   if(result.done)throw new Error('TARGET_PCM_UNDERRUN');
   next=result.value;
  }
  if(!Buffer.isBuffer(next)||next.length%4)throw new TypeError('Unaligned decoder PCM');
  if(next.length>maxBufferedFrames*4)throw new RangeError('Decoder packet too large');
  const taking=Math.min(wanted-total,next.length);
  if(taking){pieces.push(next.subarray(0,taking));total+=taking;}
  if(taking<next.length)iterator._radioRest=Buffer.from(next.subarray(taking));
 }
 return Buffer.concat(pieces,wanted);
}

/** Atomically commit one authorized overlap through the caller's PCM output.
 * Never retry output writes (they may have been partially consumed by encoder).
 * Call ONLY after timeline authority, prewarm and overlap readiness are confirmed.
 */
export async function writeLivePcmHandover({
 outgoing,incomingIterator,source,target,overlapMs=1500,curve='equalPower',
 authorized=false,write,chunkFrames=960
}={}){
 if(typeof write!=='function')throw new TypeError('PCM output writer required');
 if(!authorized)throw new Error('SOURCE_AUTHORITY_REVOKED');
 if(!Buffer.isBuffer(outgoing)||outgoing.length!==overlapMs*192)
  throw new RangeError('Outgoing window must contain exactly overlapMs PCM');
 if(!Number.isSafeInteger(chunkFrames)||chunkFrames<48||chunkFrames>4800)
  throw new RangeError('Invalid chunkFrames');
 const incoming=await readPcmFrames(incomingIterator,outgoing.length/4);
 const mixer=new RadioSourcePcmOverlap({source,target,overlapMs,curve});
 const ready=mixer.start({sourceReady:true,targetReady:true,slotAuthority:true});
 if(!ready.ok)throw new Error(ready.reason);
 let emitted=0;
 for(let offset=0;offset<outgoing.length;offset+=chunkFrames*4){
  const end=Math.min(outgoing.length,offset+chunkFrames*4);
  const result=mixer.push(outgoing.subarray(offset,end),incoming.subarray(offset,end));
  if(result.pcm.length){
   // Do not replay this buffer if the encoder rejects it.
   await write(result.pcm);
   emitted+=result.frames;
  }
 }
 if(mixer.snapshot().phase!=='COMPLETED'||emitted!==overlapMs*48)
  throw new Error('MIX_WINDOW_INCOMPLETE');
 return {status:'MIXED',sourceFramesConsumed:emitted,targetFramesConsumed:emitted,
  writtenFrames:emitted,bufferedTargetFrames:incoming.length/4};
}
