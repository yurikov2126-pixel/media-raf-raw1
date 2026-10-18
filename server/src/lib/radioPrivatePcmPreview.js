/** Short, bounded, private PCM capture for manual headset checks.
 * Only accepted voice PCM is copied; this never feeds the station encoder.
 */
export class RadioPrivatePcmPreview {
  constructor({frameBytes=3840,maxFrames=50}={}){
    if(!Number.isSafeInteger(frameBytes)||frameBytes!==3840||!Number.isSafeInteger(maxFrames)||maxFrames<1||maxFrames>50)
      throw new TypeError('INVALID_PREVIEW_CONFIG');
    this.maxFrames=maxFrames;this.reset();
  }
  reset(){this.frames=[];this.lastAt=null;this.sequence=0;}
  accept(pcm,nowMs){
    if(!Buffer.isBuffer(pcm)||pcm.length!==3840||!Number.isFinite(nowMs))
      throw new TypeError('INVALID_PCM_FRAME');
    this.frames.push(Buffer.from(pcm));
    if(this.frames.length>this.maxFrames)this.frames.shift();
    this.lastAt=nowMs;this.sequence++;
  }
  exportWav(nowMs=Date.now()){
    if(!this.frames.length||!Number.isFinite(nowMs)||this.lastAt===null||nowMs-this.lastAt>1500||nowMs<this.lastAt)
      return null;
    const payload=Buffer.concat(this.frames);
    const head=Buffer.alloc(44);
    head.write('RIFF',0);head.writeUInt32LE(36+payload.length,4);head.write('WAVE',8);
    head.write('fmt ',12);head.writeUInt32LE(16,16);head.writeUInt16LE(1,20);
    head.writeUInt16LE(2,22);head.writeUInt32LE(48000,24);
    head.writeUInt32LE(192000,28);head.writeUInt16LE(4,32);head.writeUInt16LE(16,34);
    head.write('data',36);head.writeUInt32LE(payload.length,40);
    return Buffer.concat([head,payload]);
  }
  snapshot(){return {frames:this.frames.length,durationMs:this.frames.length*20,
    lastAt:this.lastAt,connectedToEncoder:false};}
}
