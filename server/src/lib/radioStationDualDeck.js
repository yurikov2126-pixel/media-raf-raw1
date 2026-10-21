import {RadioSourcePcmOverlap} from './radioSourcePcmOverlap.js';
import {PCM_BYTES_PER_MS} from './radioPcmSourceFades.js';

/**
 * Deterministic stereo PCM handoff: one output bus, two independent decks.
 * Scheduling and prewarming are outside this class; no wall-time checks are
 * performed while blending already authorized frames.
 */
export class RadioStationDualDeck {
 constructor({overlapMs=1500,curve='equalPower'}={}){
  if(!Number.isSafeInteger(overlapMs)||overlapMs<250||overlapMs>5000)
   throw new RangeError('Invalid overlap');
  this.overlapMs=overlapMs;
  this.curve=curve;
  this.session=null;
  this.to=null;
  this.consumedFrames=0;
 }
 begin({from,to,sourceReady,targetReady,authority,publicLive=false}={}){
  if(this.session)throw new Error('Handover already active');
  if(!authority||publicLive) return {ok:false,reason:'SOURCE_AUTHORITY'};
  const mix=new RadioSourcePcmOverlap({source:from,target:to,
   overlapMs:this.overlapMs,curve:this.curve});
  const result=mix.start({sourceReady,targetReady,slotAuthority:authority,publicLive});
  if(!result.ok)return result;
  this.session=mix;this.to=to;this.consumedFrames=0;
  return {ok:true};
 }
 push(outgoing,incoming){
  if(!this.session)throw new Error('No active handover');
  const result=this.session.push(outgoing,incoming);
  this.consumedFrames=result.targetFramesConsumed;
  if(result.status==='COMPLETED'){
   const continuation={target:this.to,consumedFrames:this.consumedFrames,
    consumedMs:this.consumedFrames/48};
   this.session=null;this.to=null;
   return {...result,continuation};
  }
  return result;
 }
 abort(reason){
  if(!this.session)return {aborted:false};
  const result=this.session.abort(reason);
  this.session=null;this.to=null;
  return {aborted:true,...result};
 }
 get active(){return !!this.session;}
 get expectedBytes(){return this.overlapMs*PCM_BYTES_PER_MS;}
}
