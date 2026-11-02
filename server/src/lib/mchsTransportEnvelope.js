/** Immutable, non-actuating dispatch envelope for a future authorized transport. */
export function buildMissileTransportEnvelope({assessment,command,event,nowMs=Date.now()}={}){
 const reasons=[];
 if(assessment?.readyForFutureIntegration!==true||assessment?.holds?.length)reasons.push('INTERLOCK_NOT_READY');
 if(assessment?.executionEnabled!==false||assessment?.publicBroadcastAuthorized!==false)reasons.push('UNSAFE_INTERLOCK');
 if(!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(command?.eventType))reasons.push('TYPE_NOT_ALLOWED');
 if(command?.mode!=='DRY_RUN'||command?.speakerPlaybackEnabled!==false)reasons.push('UNSAFE_COMMAND');
 if(!event?.id||event.id!==command?.idempotencyKey)reasons.push('EVENT_ID_MISMATCH');
 if(!command?.audioAssetId||!Number.isInteger(command?.repeats)||command.repeats<1||command.repeats>5)reasons.push('INVALID_AUDIO');
 if(command?.eventType==='MISSILE_ALL_CLEAR'&&command?.repeats!==1)reasons.push('CLEAR_MUST_PLAY_ONCE');
 const occurred=Date.parse(event?.occurredAt||'');
 if(!Number.isFinite(occurred)||occurred>nowMs+30000||nowMs-occurred>120000)reasons.push('STALE_EVENT');
 const envelope=reasons.length?null:Object.freeze({eventId:event.id,eventType:command.eventType,
  assetId:command.audioAssetId,repeats:command.repeats,issuedAt:new Date(nowMs).toISOString(),
  expiresAt:new Date(nowMs+5000).toISOString(),mode:'NOT_EXECUTABLE'});
 return {envelope,reasons,transportEnabled:false,amplifierCommandEnabled:false};
}
