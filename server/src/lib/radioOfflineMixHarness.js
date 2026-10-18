import {mixRadioPcmFrames,IsolatedLiveMixer} from './radioIsolatedLiveMixer.js';
/** Offline source selection rehearsal; no connection to the live worker's encoder. */
export class RadioOfflineMixHarness {
 constructor({mixer=new IsolatedLiveMixer()}={}){this.mixer=mixer;this.decisionLog=[];this.frames=0;}
 feedVoice(packet){return this.mixer.pushVoice(packet);}
 render({music,authority,voiceConsent=false}={}){
  const allow=authority?.scheduleKnown===true&&authority?.scheduledActive===false&&
    authority?.leaseValid===true&&authority?.pcmReady===true&&voiceConsent===true;
  // If an authorized voice packet is late, the mixer fails rather than covering up loss.
  // An active scheduled show always excludes voice, regardless of browser consent.
  const result=this.mixer.mix({music,voiceAllowed:allow});
  this.decisionLog.push({source:allow?'ISOLATED_MIX':'MUSIC_ONLY',ok:result.ok,
    reason:result.reason||null,connectedToEncoder:false});
  if(this.decisionLog.length>100)this.decisionLog.shift();
  if(result.ok)this.frames++;
  return {...result,selectedSource:allow?'ISOLATED_MIX':'MUSIC_ONLY',
    changeApplied:false,connectedToEncoder:false};
 }
 reset(){this.mixer.reset();this.decisionLog=[];this.frames=0;}
 snapshot(){return {...this.mixer.snapshot(),offlineFrames:this.frames,
   decisions:this.decisionLog.slice(),connectedToEncoder:false};}
}
