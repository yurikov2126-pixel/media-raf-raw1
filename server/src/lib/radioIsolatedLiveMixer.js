/** Audio Engine 5.0: pure offline stereo PCM mixer.
 * Does NOT touch station output, processes, devices or network.
 * Fixed 48kHz stereo s16le, 20ms (3840-byte) blocks.
 */
const FRAME_BYTES=3840;
const clamp=x=>Math.max(-32768,Math.min(32767,Math.round(x)));
export function mixRadioPcmFrames({music,voice,musicGain=1,voiceGain=1,ducking=0.25}={}){
  if(!Buffer.isBuffer(music)||music.length!==FRAME_BYTES)throw new TypeError('MUSIC_FRAME_INVALID');
  if(voice!==null&&voice!==undefined&&(!Buffer.isBuffer(voice)||voice.length!==FRAME_BYTES))
    throw new TypeError('VOICE_FRAME_INVALID');
  for(const n of [musicGain,voiceGain,ducking])
    if(!Number.isFinite(n)||n<0||n>1)throw new RangeError('INVALID_GAIN');
  const out=Buffer.allocUnsafe(FRAME_BYTES);
  const musicScale=voice?musicGain*ducking:musicGain;
  for(let i=0;i<FRAME_BYTES;i+=2){
    const sample=music.readInt16LE(i)*musicScale+(voice?voice.readInt16LE(i)*voiceGain:0);
    out.writeInt16LE(clamp(sample),i);
  }
  return {pcm:out,voicePresent:!!voice,appliedMusicGain:musicScale,voiceGain:voice?voiceGain:0,
    connectedToEncoder:false};
}
export class IsolatedLiveMixer {
  constructor({maxFrames=25}={}){
    if(!Number.isSafeInteger(maxFrames)||maxFrames<1||maxFrames>250)throw new TypeError('INVALID_CAPACITY');
    this.maxFrames=maxFrames;this.reset();
  }
  reset(){this.queue=[];this.expectedIndex=null;this.mixedFrames=0;this.fault=null;}
  pushVoice({pcm,frameIndex}={}){
    if(this.fault)return {ok:false,reason:'RESET_REQUIRED'};
    if(!Buffer.isBuffer(pcm)||pcm.length!==FRAME_BYTES||!Number.isSafeInteger(frameIndex)||frameIndex<0)
      return this.fail('INVALID_VOICE_FRAME');
    if(this.expectedIndex!==null&&frameIndex!==this.expectedIndex)return this.fail('VOICE_SEQUENCE_GAP');
    if(this.queue.length>=this.maxFrames)return this.fail('VOICE_BUFFER_OVERFLOW');
    this.queue.push({pcm:Buffer.from(pcm),frameIndex});
    this.expectedIndex=frameIndex+960;
    return {ok:true,queuedFrames:this.queue.length};
  }
  mix({music,voiceAllowed=false,musicGain=1,voiceGain=1,ducking=0.25}={}){
    if(this.fault)return {ok:false,reason:this.fault,changeApplied:false};
    const voice=voiceAllowed?this.queue.shift()?.pcm:null;
    // No automatic replay/silence substitution: an authorized voice underrun is fatal.
    if(voiceAllowed&&!voice)return this.fail('VOICE_UNDERRUN');
    try{
      const result=mixRadioPcmFrames({music,voice,musicGain,voiceGain,ducking});
      this.mixedFrames++;
      return {ok:true,...result,changeApplied:false};
    }catch(error){return this.fail(error.message);}
  }
  fail(reason){this.queue=[];this.fault=reason;return {ok:false,reason,changeApplied:false};}
  snapshot(){return {mode:'ISOLATED_OFFLINE',voiceQueued:this.queue.length,mixedFrames:this.mixedFrames,
    fault:this.fault,connectedToEncoder:false,changeApplied:false};}
}
