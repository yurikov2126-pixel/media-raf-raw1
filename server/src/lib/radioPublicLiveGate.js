/** One-output source arbiter: producer is the radio Worker, never the browser.
 * All timestamps milliseconds; at most 1 second of decoded PCM retained.
 */
export class RadioPublicLiveGate {
 constructor({maxFrames=50,staleMs=1200}={}){this.maxFrames=maxFrames;this.staleMs=staleMs;this.reset();}
 reset(){this.onAir=false;this.queue=[];this.lastAt=null;this.ownerToken=null;this.reason='IDLE';this.frames=0;}
 ingest(pcm,token,now=Date.now()){
  if(typeof token!=='string'||!token||!Buffer.isBuffer(pcm)||pcm.length!==3840||!Number.isFinite(now))return false;
  if(this.ownerToken&&token!==this.ownerToken)return false;
  this.ownerToken=token;this.lastAt=now;
  this.queue.push(Buffer.from(pcm));
  if(this.queue.length>this.maxFrames)this.queue.shift();
  return true;
 }
 start(token,now=Date.now()){
  if(this.onAir)return {ok:false,reason:'ALREADY_ON_AIR'};
  if(!token||token!==this.ownerToken)return {ok:false,reason:'SESSION_MISMATCH'};
  if(this.queue.length<10||this.lastAt===null||now-this.lastAt>600)
   return {ok:false,reason:'PCM_NOT_READY'};
  this.onAir=true;this.reason='PRESENTER';return {ok:true};
 }
 take(now=Date.now()){
  if(!this.onAir)return null;
  if(this.lastAt===null||now-this.lastAt>this.staleMs){
   this.reset();this.reason='PCM_TIMEOUT';return null;
  }
  const frame=this.queue.shift();
  if(frame){this.frames++;return frame;}
  return Buffer.alloc(3840);
 }
 stop(reason='STOPPED'){this.reset();this.reason=reason;}
 snapshot(){return {onAir:this.onAir,bufferedFrames:this.queue.length,lastAt:this.lastAt,
  frames:this.frames,reason:this.reason,mode:this.onAir?'LIVE':'AUTO_DJ'};}
}
