/** Last interlock before any future MCHS audio transport.
 * Deliberately does not switch public output on; fail closed for unknown status.
 */
export function assessMissileExecutionInterlock({command,sourceEvent,checkpoint,workerReady=false,agentReady=false,stopReady=false,operatorHold=true,nowMs=Date.now()}={}){
 const holds=[];
 const type=command?.eventType;
 if(!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(type))holds.push('TYPE_NOT_ALLOWED');
 if(command?.mode!=='DRY_RUN'||command?.speakerPlaybackEnabled!==false)holds.push('NOT_ISOLATED_COMMAND');
 if(!command?.idempotencyKey||!sourceEvent?.id||command.idempotencyKey!==sourceEvent.id)holds.push('EVENT_MISMATCH');
 if(!command?.audioAssetId||!Number.isInteger(command?.repeats)||command.repeats<1||command.repeats>5)holds.push('INVALID_AUDIO_PLAN');
 if(type==='MISSILE_ALL_CLEAR'&&command?.repeats!==1)holds.push('CLEAR_REPEATS_INVALID');
 if(sourceEvent?.source!=='MCHS_ANDROID'||sourceEvent?.verified!==true)holds.push('SOURCE_NOT_VERIFIED');
 if(sourceEvent?.region?.trim().toLocaleLowerCase('ru-RU')!=='тульская область')holds.push('REGION_UNVERIFIED');
 const occurred=Date.parse(sourceEvent?.occurredAt||'');
 if(!Number.isFinite(occurred)||occurred>nowMs+30000||nowMs-occurred>120000)holds.push('EVENT_EXPIRED');
 if(checkpoint?.lastEventId!==sourceEvent?.id)holds.push('CHECKPOINT_NOT_CURRENT');
 if(checkpoint?.state!==(type==='MISSILE_DANGER'?'DANGER':'CLEAR'))holds.push('STATE_NOT_CURRENT');
 if(!workerReady)holds.push('WORKER_UNAVAILABLE');
 if(!agentReady)holds.push('AGENT_UNAVAILABLE');
 if(!stopReady)holds.push('STOP_UNCONFIRMED');
 if(operatorHold)holds.push('OPERATOR_HOLD');
 return {readyForFutureIntegration:holds.length===0,holds,
   executionEnabled:false,publicBroadcastAuthorized:false,amplifierAuthorized:false,output:'INTERLOCK_ONLY'};
}
