/**
 * 20ms deterministic speech sensing and gain envelopes for isolated headphone monitor.
 * No timers, no public stream routing, no source switching.
 */
export class RadioVoiceDuckingEnvelope {
 constructor({thresholdDb=-39,attackMs=100,releaseMs=700,holdMs=300,duckGain=0.28}={}){
  if(!Number.isFinite(thresholdDb)||thresholdDb>0||thresholdDb< -90||
   !Number.isInteger(attackMs)||attackMs<20||attackMs>3000||
   !Number.isInteger(releaseMs)||releaseMs<20||releaseMs>10000||
   !Number.isInteger(holdMs)||holdMs<0||holdMs>5000||
   !Number.isFinite(duckGain)||duckGain<0||duckGain>1)throw new TypeError('INVALID_DUCKING_CONFIG');
  Object.assign(this,{thresholdDb,attackMs,releaseMs,holdMs,duckGain});this.reset();
 }
 reset(){this.gain=1;this.holdRemaining=0;this.speech=false;this.frames=0;}
 step(pcm){
  if(!Buffer.isBuffer(pcm)||pcm.length!==3840)throw new TypeError('INVALID_VOICE_FRAME');
  let sum=0;
  for(let i=0;i<pcm.length;i+=2){const v=pcm.readInt16LE(i)/32768;sum+=v*v;}
  const rms=Math.sqrt(sum/(pcm.length/2));
  const db=rms?20*Math.log10(rms):-120;
  this.speech=db>=this.thresholdDb;
  if(this.speech)this.holdRemaining=this.holdMs;
  else this.holdRemaining=Math.max(0,this.holdRemaining-20);
  const duck=this.speech||this.holdRemaining>0;
  const target=duck?this.duckGain:1;
  const duration=duck?this.attackMs:this.releaseMs;
  const alpha=Math.min(1,20/duration);
  this.gain+=(target-this.gain)*alpha;
  this.frames++;
  return {musicGain:this.gain,voicePresent:this.speech,rmsDb:db,
   duckingActive:duck,frames:this.frames};
 }
 snapshot(){return {musicGain:this.gain,voiceDetected:this.speech,
  holdRemainingMs:this.holdRemaining,frames:this.frames,mode:'ISOLATED_AUTOMIX'};}
}
