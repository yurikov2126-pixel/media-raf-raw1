import {mixRadioPcmFrames} from './radioIsolatedLiveMixer.js';

/** Build an audible, fully offline stereo WAV demo of the radio mixer.
 * No live microphone is recorded; both tones are synthetic. The WAV is
 * returned only to a local test script, never streamed from the Worker.
 */
export function makeOfflineRadioWav({seconds=3,sampleRate=48000,voiceHz=220,musicHz=440}={}){
  if(!Number.isInteger(seconds)||seconds<1||seconds>30||
    sampleRate!==48000||!Number.isFinite(voiceHz)||voiceHz<=0||voiceHz>=24000||
    !Number.isFinite(musicHz)||musicHz<=0||musicHz>=24000)
    throw new TypeError('INVALID_WAV_DEMO_SETTINGS');
  const frames=seconds*50,pcm=Buffer.alloc(frames*3840);
  for(let f=0;f<frames;f++){
    const music=Buffer.alloc(3840);
    const voice=Buffer.alloc(3840);
    const hasVoice=f>=50&&f<Math.min(frames,125);
    for(let n=0;n<960;n++){
      const position=f*960+n;
      const m=Math.round(9000*Math.sin(2*Math.PI*musicHz*position/sampleRate));
      const v=Math.round(11000*Math.sin(2*Math.PI*voiceHz*position/sampleRate));
      for(const offset of [0,2]){
        music.writeInt16LE(m,n*4+offset);
        voice.writeInt16LE(v,n*4+offset);
      }
    }
    const mixed=mixRadioPcmFrames({music,voice:hasVoice?voice:null,ducking:0.25});
    mixed.pcm.copy(pcm,f*3840);
  }
  const header=Buffer.alloc(44);
  header.write('RIFF',0);header.writeUInt32LE(36+pcm.length,4);header.write('WAVE',8);
  header.write('fmt ',12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);
  header.writeUInt16LE(2,22);header.writeUInt32LE(sampleRate,24);
  header.writeUInt32LE(sampleRate*4,28);header.writeUInt16LE(4,32);
  header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  return Buffer.concat([header,pcm]);
}
