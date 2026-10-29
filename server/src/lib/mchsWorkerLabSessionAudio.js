/** Bounded mono PCM16 WAV chunk, generated only for the isolated laboratory browser monitor. */
export function makeMchsLabSessionChunk(phase,{sampleRate=24000,frames=12000}={}){
 if(!['IDLE','PROGRAM','ALERT'].includes(phase))throw new RangeError('Invalid phase');
 if(sampleRate!==24000||frames!==12000)throw new RangeError('Invalid PCM format');
 const wav=Buffer.alloc(44+frames*2);
 wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
 wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
 wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*2,28);
 wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
 wav.write('data',36);wav.writeUInt32LE(frames*2,40);
 for(let i=0;i<frames;i++){
  const t=i/sampleRate,fade=Math.min(1,i/240,(frames-i-1)/240);
  const v=phase==='PROGRAM'?(Math.sin(2*Math.PI*220*t)*0.09+Math.sin(2*Math.PI*330*t)*0.035):
   phase==='ALERT'?Math.sin(2*Math.PI*740*t)*0.13:0;
  wav.writeInt16LE(Math.round(v*fade*32767),44+i*2);
 }
 return wav;
}
