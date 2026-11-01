/** Generates non-executable playback intents from independently verified missile decisions.
 * Never calls the Radio Worker: dispatch requires a separate authorized transport.
 */
export function planMissilePlayback(decisions,{alreadyHandled=new Set(),alarmActive=false}={}){
 const commands=[];
 for(const decision of decisions){
  if(!decision?.eligible||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(decision.eventType))continue;
  if(!decision.eventId||!decision.audioAssetId||alreadyHandled.has(decision.eventId))continue;
  const action=decision.eventType==='MISSILE_DANGER'?'PLAY_DANGER':'PLAY_ALL_CLEAR';
  commands.push({idempotencyKey:decision.eventId,eventType:decision.eventType,
   action,audioAssetId:decision.audioAssetId,mode:'DRY_RUN',speakerPlaybackEnabled:false,
   interruptCurrentAlarm:alarmActive&&action==='PLAY_ALL_CLEAR'});
  alreadyHandled.add(decision.eventId);
 }
 return {commands,executionEnabled:false,output:'PLANNED_ONLY'};
}
