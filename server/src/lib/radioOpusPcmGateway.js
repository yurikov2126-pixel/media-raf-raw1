import {spawn} from 'node:child_process';
/** Converts a trusted WebM/Opus byte stream into 48k stereo s16le PCM.
 * Never binds a public socket or connects to the station encoder.
 */
export function createOpusPcmDecoder({ffmpeg='ffmpeg',spawnProcess=spawn}={}){
 const child=spawnProcess(ffmpeg,['-hide_banner','-loglevel','error','-nostdin',
  '-f','webm','-i','pipe:0','-vn','-ac','2','-ar','48000',
  '-f','s16le','-acodec','pcm_s16le','pipe:1'],{stdio:['pipe','pipe','pipe']});
 return child;
}
/** Packages FFmpeg PCM into 20 ms (3840-byte) ordered chunks. */
export async function* pcmPacketize(source,{packetBytes=3840,maxBufferedBytes=19200}={}){
 if(!Number.isSafeInteger(packetBytes)||packetBytes<=0||packetBytes%4||
  !Number.isSafeInteger(maxBufferedBytes)||maxBufferedBytes<packetBytes)
  throw new TypeError('Invalid PCM packetizer configuration');
 let pending=Buffer.alloc(0),frameIndex=0;
 for await(const chunk of source){
  if(!Buffer.isBuffer(chunk))throw new TypeError('Decoder must emit PCM buffers');
  let index=0;
  while(index<chunk.length){
   const n=Math.min(packetBytes-pending.length,chunk.length-index);
   pending=Buffer.concat([pending,chunk.subarray(index,index+n)]);index+=n;
   if(pending.length===packetBytes){
    yield {pcm:pending,frameIndex};
    frameIndex+=packetBytes/4;pending=Buffer.alloc(0);
   }
   if(pending.length>maxBufferedBytes)throw new RangeError('PCM staging overflow');
  }
 }
 // Incomplete trailing PCM must not enter the station; no padding/replay.
}
