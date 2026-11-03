/** Read-only admission for a proposed *local headphones* Windows Agent trial.
 * This function never queues commands or starts audio. It cannot establish
 * physical output isolation from server-side state or telemetry.
 */
const EVENT_TYPES=new Set(['MISSILE_DANGER','MISSILE_ALL_CLEAR']);
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const SHA=/^[a-f0-9]{64}$/;

export function assessMchsAgentTrialStart({event,request={},deviceBound=false,
 trialEnabled=false,operatorIsolationConfirmed=false,nowMs=Date.now()}={}){
 const deny=reason=>({ready:false,reason,publicPlaybackAuthorized:false,
  physicalPaVerified:false});
 if(!deviceBound)return deny('DEVICE_NOT_BOUND');
 if(!trialEnabled)return deny('TRIAL_DISABLED');
 if(!operatorIsolationConfirmed)return deny('OPERATOR_ISOLATION_REQUIRED');
 if(!event||event.source!=='MCHS_ANDROID'||event.verified!==true)
  return deny('VERIFIED_ANDROID_EVENT_REQUIRED');
 if(!ID.test(event.id||''))return deny('INVALID_EVENT_ID');
 const occurredAt=Date.parse(event.occurredAt||'');
 if(!Number.isFinite(occurredAt)||nowMs-occurredAt<0||nowMs-occurredAt>120000)
  return deny('EVENT_NOT_FRESH');
 if(!EVENT_TYPES.has(request.eventType))return deny('INVALID_EVENT_TYPE');
 const words=((event.title||'')+' '+(event.body||'')).toLowerCase();
 const detected=/(отбой|отмена).*ракетн/.test(words)?'MISSILE_ALL_CLEAR':
  /ракетн.*опасност/.test(words)?'MISSILE_DANGER':null;
 if(detected!==request.eventType)return deny('EVENT_TYPE_MISMATCH');
 if(!ID.test(request.assetId||'')||!SHA.test(request.sha256||''))
  return deny('INVALID_LOCAL_AUDIO_BINDING');
 if(!Number.isSafeInteger(request.repeats)||request.repeats<1||
    request.repeats>5||(request.eventType==='MISSILE_ALL_CLEAR'&&request.repeats!==1))
  return deny('INVALID_REPEAT_COUNT');
 return {ready:true,reason:'ISOLATED_HEADPHONES_PREFLIGHT_ONLY',
  eventId:event.id,eventType:request.eventType,assetId:request.assetId,
  sha256:request.sha256,repeats:request.repeats,
  publicPlaybackAuthorized:false,physicalPaVerified:false};
}
