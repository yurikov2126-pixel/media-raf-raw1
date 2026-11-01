/** Non-actuating state machine for a future verified MCHS ALARM executor.
 * Does not make events official, decode PCM or alter the station.
 */
export function createMissileAlarmExecutorGuard(){
 let state='IDLE',lastCommandId=null,revision=0;
 const snapshot=()=>({state,lastCommandId,revision,automaticPlaybackEnabled:false,audioOutput:'UNMODIFIED'});
 const decide=(command)=>{
  if(!command||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(command.eventType))return {ok:false,reason:'TYPE_NOT_ALLOWED',...snapshot()};
  if(!command.commandId||typeof command.commandId!=='string'||!command.audioAssetId)return {ok:false,reason:'INVALID_COMMAND',...snapshot()};
  if(lastCommandId===command.commandId)return {ok:false,reason:'DUPLICATE_COMMAND',...snapshot()};
  if(state==='HALTED')return {ok:false,reason:'OPERATOR_HALT',...snapshot()};
  if(command.eventType==='MISSILE_DANGER'&&state!=='IDLE')return {ok:false,reason:'DANGER_ALREADY_ACTIVE',...snapshot()};
  if(command.eventType==='MISSILE_ALL_CLEAR'&&state!=='DANGER_PREPARED')return {ok:false,reason:'NO_ACTIVE_DANGER',...snapshot()};
  state=command.eventType==='MISSILE_DANGER'?'DANGER_PREPARED':'CLEAR_PREPARED';
  lastCommandId=command.commandId;revision++;
  return {ok:true,action:'PREPARE_ONLY',...snapshot()};
 };
 return {snapshot,decide,halt:()=>{state='HALTED';revision++;return snapshot();},
  resetForTest:()=>{state='IDLE';lastCommandId=null;revision++;return snapshot();}};
}
