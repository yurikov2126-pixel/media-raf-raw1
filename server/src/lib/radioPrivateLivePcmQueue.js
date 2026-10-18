/** Server-only bounded PCM frame replay queue for private, near-live auditions.
 * A consumer supplies the previous sequence, never an arbitrary buffer offset.
 */
export class RadioPrivateLivePcmQueue {
 constructor({maxFrames=75}={}){
  if(!Number.isSafeInteger(maxFrames)||maxFrames<10||maxFrames>150)throw new TypeError('INVALID_CAPACITY');
  this.maxFrames=maxFrames;this.reset();
 }
 reset(){this.frames=[];this.nextSequence=0;this.lastAt=null;}
 push(pcm,nowMs){
  if(!Buffer.isBuffer(pcm)||pcm.length!==3840||!Number.isFinite(nowMs))throw new TypeError('INVALID_FRAME');
  this.frames.push({sequence:this.nextSequence++,pcm:Buffer.from(pcm)});
  if(this.frames.length>this.maxFrames)this.frames.shift();
  this.lastAt=nowMs;
 }
 read({after=null,max=10,nowMs=Date.now()}={}){
  if(!Number.isSafeInteger(max)||max<1||max>10)throw new TypeError('INVALID_READ_SIZE');
  if(after!==null&&(!Number.isSafeInteger(after)||after<0))throw new TypeError('INVALID_CURSOR');
  if(this.lastAt===null||nowMs<this.lastAt||nowMs-this.lastAt>1500)
    return {ok:false,reason:'PCM_STALE'};
  const first=this.frames[0]?.sequence;
  if(first===undefined)return {ok:false,reason:'BUFFER_EMPTY'};
  if(after!==null&&after<first-1)return {ok:false,reason:'CURSOR_EXPIRED'};
  const selected=this.frames.filter(f=>after===null?f.sequence>=Math.max(first,this.nextSequence-max):f.sequence>after).slice(0,max);
  return {ok:true,frames:selected.map(f=>({sequence:f.sequence,pcmBase64:f.pcm.toString('base64')})),
    nextSequence:selected.at(-1)?.sequence??after,latestSequence:this.nextSequence-1,
    connectedToEncoder:false,changeApplied:false};
 }
 snapshot(){return {bufferedFrames:this.frames.length,latestSequence:this.nextSequence-1,
   connectedToEncoder:false};}
}
