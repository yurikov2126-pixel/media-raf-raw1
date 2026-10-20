/** Signed 16-bit, stereo, 48 kHz dual-deck PCM mixer.
 * No encoder, decoder, socket or clock side effects.
 * Each input frame is consumed at most once; on an unavailable deck, returns
 * the available unmodified PCM rather than zero-filling or replaying a tail.
 */
const FRAME_BYTES=4;
const BYTES_PER_MS=192;
export const MAX_HANDOVER_MS=5000;
export function normalizeHandover(input){
 if(!input||!Number.isInteger(input.overlapMs)||input.overlapMs<250||
   input.overlapMs>MAX_HANDOVER_MS||
   !['linear','equalPower','sCurve'].includes(input.curve))
  throw new TypeError('Invalid handover settings');
 return Object.freeze({overlapMs:input.overlapMs,curve:input.curve});
}
function gains(fraction,curve){
 const t=Math.max(0,Math.min(1,fraction));
 if(curve==='linear')return [1-t,t];
 if(curve==='sCurve'){const smooth=t*t*(3-2*t);return [1-smooth,smooth];}
 return [Math.cos(t*Math.PI/2),Math.sin(t*Math.PI/2)];
}
function input(value,label){
 if(value===null)return null;
 if(!Buffer.isBuffer(value)||value.length%FRAME_BYTES)
  throw new TypeError(label+' must be stereo s16le PCM frames');
 return value;
}
export function mixDualDeckPcm(outgoing,incoming,settings,{offsetFrames=0}={}){
 const config=normalizeHandover(settings);
 const from=input(outgoing,'outgoing');
 const to=input(incoming,'incoming');
 if(!Number.isSafeInteger(offsetFrames)||offsetFrames<0)
  throw new RangeError('Invalid handover frame offset');
 if(from===null&&to===null)return {pcm:Buffer.alloc(0),status:'NO_SOURCE',frames:0};
 if(from===null)return {pcm:Buffer.from(to),status:'INCOMING_ONLY',frames:to.length/4};
 if(to===null)return {pcm:Buffer.from(from),status:'OUTGOING_ONLY',frames:from.length/4};
 if(from.length!==to.length)throw new RangeError('Decks have different PCM frame counts');
 const totalFrames=Math.round(config.overlapMs*48);
 if(offsetFrames+from.length/4>totalFrames)throw new RangeError('Handover overran overlap window');
 const out=Buffer.allocUnsafe(from.length);
 for(let i=0;i<from.length;i+=4){
  const [a,b]=gains((offsetFrames+i/4)/Math.max(1,totalFrames-1),config.curve);
  for(let channel=0;channel<4;channel+=2){
   const value=Math.round(from.readInt16LE(i+channel)*a+to.readInt16LE(i+channel)*b);
   out.writeInt16LE(Math.max(-32768,Math.min(32767,value)),i+channel);
  }
 }
 return {pcm:out,status:'MIXED',frames:out.length/4};
}
export function createHandoverSession(settings){
 const config=normalizeHandover(settings);
 let offsetFrames=0,closed=false;
 return {
  write(outgoing,incoming){
   if(closed)throw new Error('Handover already completed');
   const result=mixDualDeckPcm(outgoing,incoming,config,{offsetFrames});
   offsetFrames+=result.frames;
   if(offsetFrames>config.overlapMs*48)throw new RangeError('Handover overrun');
   if(offsetFrames===config.overlapMs*48)closed=true;
   return result;
  },
  snapshot(){return {offsetFrames,remainingFrames:config.overlapMs*48-offsetFrames,closed};},
 };
}
