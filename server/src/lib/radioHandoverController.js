/** Pure fail-closed handover coordinator.
 * No audio routing side effects; only a READY pair can enter MIXING.
 */
export class RadioHandoverController {
 constructor({overlapMs=1000}={}){
  if(!Number.isSafeInteger(overlapMs)||overlapMs<250||overlapMs>5000)
   throw new RangeError('Invalid overlap window');
  this.overlapMs=overlapMs;
  this.reset();
 }
 reset(){
  this.phase='IDLE';this.source=null;this.target=null;
  this.reasons=[];this.emittedFrames=0;this.targetFrameOffset=0;
 }
 reserve({source,target,sourceReady,targetReady,publicLive=false,slotAuthority=true}){
  if(this.phase!=='IDLE')return {ok:false,reason:'ALREADY_RESERVED'};
  if(!source?.id||!target?.id||source.id===target.id)return {ok:false,reason:'INVALID_PAIR'};
  if(publicLive||!slotAuthority)return {ok:false,reason:'SOURCE_AUTHORITY_BLOCKED'};
  this.source=source;this.target=target;
  if(!sourceReady||!targetReady){
   this.phase='FALLBACK';this.reasons=[!sourceReady?'SOURCE_NOT_READY':'TARGET_NOT_READY'];
   return {ok:false,reason:this.reasons[0],fallback:this.safeFallback()};
  }
  this.phase='READY';
  return {ok:true,sourceId:source.id,targetId:target.id};
 }
 start(){
  if(this.phase!=='READY')return {ok:false,reason:'NOT_READY'};
  this.phase='MIXING';return {ok:true};
 }
 commit(frames,{bothDecksEmitted=true}={}){
  if(this.phase!=='MIXING'||!Number.isSafeInteger(frames)||frames<=0||
     this.emittedFrames+frames>this.overlapMs*48)
    return {ok:false,reason:'INVALID_FRAME_COMMIT'};
  if(!bothDecksEmitted){
   this.phase='FALLBACK';this.reasons.push('DECK_UNDERRUN');
   return {ok:false,reason:'DECK_UNDERRUN',fallback:this.safeFallback()};
  }
  this.emittedFrames+=frames;this.targetFrameOffset+=frames;
  if(this.emittedFrames===this.overlapMs*48)this.phase='COMPLETED';
  return {ok:true,completed:this.phase==='COMPLETED',targetFrameOffset:this.targetFrameOffset};
 }
 fail(reason){
  if(this.phase==='COMPLETED')return {ok:false,reason:'ALREADY_COMPLETED'};
  this.reasons.push(String(reason||'UNKNOWN'));
  this.phase='FALLBACK';
  return {ok:false,reason:this.reasons.at(-1),fallback:this.safeFallback({sourceAvailable,targetAvailable})};
 }
 safeFallback({sourceAvailable=true,targetAvailable=true}={}){
  // Never replay target frames already emitted as mixed PCM.
  // If target was unavailable, remain on currently available source.
  const targetChosen=this.targetFrameOffset>0&&targetAvailable;
  const sourceId=targetChosen?this.target?.id:sourceAvailable?this.source?.id:targetAvailable?this.target?.id:null;
  return {mode:sourceId?'SINGLE_SOURCE':'NO_SOURCE',sourceId,
    skipTargetFrames:sourceId===this.target?.id?this.targetFrameOffset:0};
 }
 snapshot(){return {phase:this.phase,sourceId:this.source?.id||null,
  targetId:this.target?.id||null,emittedFrames:this.emittedFrames,
  targetFrameOffset:this.targetFrameOffset,reasons:[...this.reasons]};}
}
