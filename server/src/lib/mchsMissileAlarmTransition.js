/** Pure, fail-closed transition planner for missile ALARM messages.
 * All actions are proposals only. Nothing actuates a worker, PA or radio stream.
 */
export function planMissileAlarmTransition({state='UNKNOWN',activeEventId=null,command,operatorHold=true}={}){
 const blocked=(reason)=>({accepted:false,reason,action:'NONE',executionEnabled:false});
 if(operatorHold)return blocked('OPERATOR_HOLD');
 if(!command||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(command.eventType))return blocked('INVALID_TYPE');
 if(command.status!=='ACKED_DRY_RUN'||!command.eventId||!command.audioAssetId)return blocked('NO_CONFIRMED_INTENT');
 if(command.eventType==='MISSILE_DANGER'){
  if(state==='DANGER')return blocked('DANGER_ALREADY_ACTIVE');
  if(state!=='CLEAR')return blocked('UNKNOWN_STATE');
  return {accepted:true,action:'PREPARE_DANGER',nextState:'DANGER',resumePolicy:'NEXT_SCHEDULE_AUTHORITY',executionEnabled:false};
 }
 if(state!=='DANGER')return blocked('NO_ACTIVE_DANGER');
 if(activeEventId&&command.eventId===activeEventId)return blocked('SAME_EVENT_ID');
 return {accepted:true,action:'PREPARE_ALL_CLEAR',nextState:'CLEAR',resumePolicy:'NEXT_SCHEDULE_AUTHORITY',executionEnabled:false};
}
