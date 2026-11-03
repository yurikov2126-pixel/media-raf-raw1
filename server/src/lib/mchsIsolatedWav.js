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

/** Deliberately non-alarm lab identification tone. No database or radio asset.
 * 2 seconds of stereo PCM16 48 kHz: three quiet 660 Hz beeps.
 */
export function createIsolatedSelfTestPcm(){
 const sampleRate=48000;
 const seconds=2;
 const size=sampleRate*seconds*4;
 let closed=false;
 return {size,
  read(position,length){
   if(closed)throw new Error('SELF_TEST_CLOSED');
   if(!Number.isInteger(position)||position<0||position>size||
      !Number.isInteger(length)||length<0)throw new RangeError('INVALID_PCM_RANGE');
   const usable=Math.min(length,size-position);
   const buffer=Buffer.alloc(usable);
   const beeps=[0.15,0.8,1.45];
   const frames=Math.floor(usable/4);
   for(let i=0;i<frames;i++){
    const t=(position/4+i)/sampleRate;
    const inside=beeps.some(start=>t>=start&&t<start+0.18);
    const amplitude=inside?Math.round(2200*Math.sin(2*Math.PI*660*t)):0;
    buffer.writeInt16LE(amplitude,i*4);
    buffer.writeInt16LE(amplitude,i*4+2);
   }
   return buffer;
  },
  close(){closed=true;}
 };
}
