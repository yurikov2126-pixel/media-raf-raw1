/**
 * Offline synthetic Worker lab PCM scenarios. No station encoder, audio assets,
 * GPIO, live output or emergency control is ever accessed.
 */
export const WORKER_LAB_SCENARIOS=Object.freeze(['resume','stop','repeat']);
export function makeWorkerLabScenarioWav(scenario='resume',sampleRate=24000){
 if(!WORKER_LAB_SCENARIOS.includes(scenario))throw new RangeError('Unknown lab scenario');
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>48000)throw new RangeError('Invalid sample rate');
 const duration=scenario==='repeat'?9:6, frames=sampleRate*duration;
 const output=Buffer.alloc(44+frames*2);
 output.write('RIFF',0);output.writeUInt32LE(output.length-8,4);
 output.write('WAVEfmt ',8);output.writeUInt32LE(16,16);
 output.writeUInt16LE(1,20);output.writeUInt16LE(1,22);
 output.writeUInt32LE(sampleRate,24);output.writeUInt32LE(sampleRate*2,28);
 output.writeUInt16LE(2,32);output.writeUInt16LE(16,34);
 output.write('data',36);output.writeUInt32LE(frames*2,40);
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 // 0-2 programme; 2-4 alert; 4-6 resume or hard stop.
 // repeat: 4-6 programme, 6-7 second alert, 7-9 programme.
 for(let i=0;i<frames;i++){
  const t=i/sampleRate;
  const firstCue=t>=2&&t<4;
  const secondCue=scenario==='repeat'&&t>=6&&t<7;
  const isCue=firstCue||secondCue;
  let programmeGain=0;
  if(t<2)programmeGain=t<1.85?1:clamp((2-t)/0.15,0,1);
  else if(scenario!=='stop'&&t>=4){
   if(secondCue)programmeGain=0;
   else if(t<4.2)programmeGain=clamp((t-4)/0.2,0,1);
   else if(scenario==='repeat'&&t>=5.85&&t<6)programmeGain=clamp((6-t)/0.15,0,1);
   else if(scenario==='repeat'&&t>=7&&t<7.2)programmeGain=clamp((t-7)/0.2,0,1);
   else programmeGain=1;
  }
  const cueStart=firstCue?2:6,cueEnd=firstCue?4:7;
  const cueGain=isCue?clamp(Math.min((t-cueStart)/0.05,(cueEnd-t)/0.05),0,1):0;
  const programme=(Math.sin(2*Math.PI*220*t)*0.09+Math.sin(2*Math.PI*330*t)*0.04)*programmeGain;
  const cue=(Math.sin(2*Math.PI*740*t)*0.14)*cueGain;
  output.writeInt16LE(Math.round(clamp(programme+cue,-1,1)*32767),44+i*2);
 }
 return output;
}
