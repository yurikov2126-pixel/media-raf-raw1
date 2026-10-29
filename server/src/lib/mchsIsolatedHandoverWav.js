/**
 * Isolated synthetic audio handover: program -> emergency cue -> program.
 * Creates an offline WAV fixture only; never accesses Radio Worker/PCM or PA.
 * Signal is original generated tones, not a real MCHS announcement.
 */
export function makeIsolatedHandoverWav({sampleRate=24000}={}){
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>48000)throw new RangeError('Invalid sample rate');
 const duration=6,frames=sampleRate*duration,dataBytes=frames*2,out=Buffer.alloc(44+dataBytes);
 out.write('RIFF',0);out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);
 out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);
 out.writeUInt32LE(sampleRate,24);out.writeUInt32LE(sampleRate*2,28);
 out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(dataBytes,40);
 for(let i=0;i<frames;i++){
  const t=i/sampleRate;
  const background=Math.sin(2*Math.PI*220*t)*0.10+Math.sin(2*Math.PI*330*t)*0.04;
  // 0-2s programme; 2-4s interruption; 4-6s new programme position.
  const programmeGain=t<1.85?1:t<2?Math.max(0,(2-t)/0.15):t<4?0:t<4.2?(t-4)/0.2:1;
  const cueGain=t<2||t>=4?0:Math.min(1,(t-2)/0.05,(4-t)/0.05);
  const cue=Math.sin(2*Math.PI*(t<3?740:880)*t)*0.15*cueGain;
  const sample=Math.max(-1,Math.min(1,background*programmeGain+cue));
  out.writeInt16LE(Math.round(sample*32767),44+i*2);
 }
 return out;
}
