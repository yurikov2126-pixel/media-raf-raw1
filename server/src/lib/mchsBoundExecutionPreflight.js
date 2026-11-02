import {assessMissileAutoEvent,missileNextState} from './mchsMissileAutoGate.js';
import {verifyMchsAudioBinding,assessMchsChannelAudioAgreement} from './mchsEventAudioBinding.js';

/** Non-actuating preflight for the two real channels. Verify immutable audio
 * BEFORE any START command; a digest alone is never proof of audible output.
 */
export function prepareMchsBoundExecution({
 observation,checkpoint,rules,asset,bytes,workerAsset,agentAsset,
 seenIds=new Set(),officialSourceVerified=false,nowMs=Date.now()
}={}){
 const deny=reason=>({ready:false,reason,publicPlaybackAuthorized:false,command:null});
 const accepted=assessMissileAutoEvent(observation,{rules,seenIds,nowMs});
 if(!accepted.eligible)return deny(accepted.reason);
 if(officialSourceVerified!==true)return deny('OFFICIAL_SOURCE_NOT_VERIFIED');
 const transition=missileNextState(checkpoint?.state||'UNKNOWN',accepted.eventType);
 if(!transition.accepted)return deny(transition.reason);
 const repeats=accepted.eventType==='MISSILE_ALL_CLEAR'?1:rules?.MISSILE_DANGER?.repeats;
 const event={id:observation.id,eventType:accepted.eventType,assetId:accepted.audioAssetId,repeats};
 const binding=verifyMchsAudioBinding({event,asset,bytes});
 if(!binding.verified)return deny(binding.reason);
 const agreement=assessMchsChannelAudioAgreement(binding,workerAsset,agentAsset);
 if(!agreement.agreed)return deny(agreement.reason);
 return {ready:true,reason:null,publicPlaybackAuthorized:false,
  command:null,binding,proposedState:transition.state,sourceEventId:observation.sourceEventId};
}
