/** Isolated, read-only WAV output. Never writes the public station encoder.
 * PCM must be verified/decrypted by the Worker before this response begins.
 */
export function wavHeader(bytes){
 if(!Number.isSafeInteger(bytes)||bytes<=0||bytes>0xffffffff-44||bytes%4!==0)
  throw new RangeError('INVALID_PCM_LENGTH');
 const h=Buffer.alloc(44);
 h.write('RIFF',0);h.writeUInt32LE(bytes+36,4);h.write('WAVEfmt ',8);
 h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);
 h.writeUInt32LE(48000,24);h.writeUInt32LE(192000,28);
 h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);
 h.write('data',36);h.writeUInt32LE(bytes,40);
 return h;
}
export function createIsolatedPcmWavStream(pcm,{chunkSize=3840}={}){
 if(!pcm||typeof pcm.read!=='function'||typeof pcm.close!=='function')
  throw new TypeError('PCM_REQUIRED');
 const header=wavHeader(pcm.size);
 let position=0,closed=false;
 const close=()=>{if(!closed){closed=true;pcm.close();}};
 return {header,close,
  next(){
   if(closed)return null;
   if(position===pcm.size){close();return null;}
   const frame=pcm.read(position,Math.min(chunkSize,pcm.size-position));
   if(!Buffer.isBuffer(frame)||frame.length===0){close();throw Error('PCM_TRUNCATED');}
   position+=frame.length;
   return frame;
  }
 };
}
