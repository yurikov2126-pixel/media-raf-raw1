import {createHash,timingSafeEqual} from 'node:crypto';

/** Verify that the exact ALARM bytes delivered to each output belong to the
 * accepted event. Metadata or a file name by itself is not audio evidence.
 */
export function verifyMchsAudioBinding({event,asset,bytes}={}){
 const fail=reason=>({verified:false,reason});
 if(!event||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(event.eventType)||
  typeof event.id!=='string'||!event.id||typeof event.assetId!=='string'||!event.assetId)
  return fail('INVALID_EVENT');
 if(!asset||asset.id!==event.assetId||asset.eventType!==event.eventType)
  return fail('ASSET_EVENT_MISMATCH');
 if(typeof asset.sha256!=='string'||!/^[a-f0-9]{64}$/.test(asset.sha256))
  return fail('UNVERIFIED_AUDIO_DIGEST');
 if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>50*1024*1024)
  return fail('INVALID_AUDIO_BYTES');
 const digest=createHash('sha256').update(bytes).digest();
 if(!timingSafeEqual(digest,Buffer.from(asset.sha256,'hex')))
  return fail('AUDIO_DIGEST_MISMATCH');
 if(!Number.isInteger(event.repeats)||event.repeats<1||event.repeats>5||
   (event.eventType==='MISSILE_ALL_CLEAR'&&event.repeats!==1))
  return fail('INVALID_REPEAT_POLICY');
 return {verified:true,reason:null,assetId:asset.id,eventId:event.id,
  eventType:event.eventType,repeats:event.repeats,sha256:asset.sha256,
  byteLength:bytes.length,publicPlaybackAuthorized:false};
}

/** Both independent channels must attest to *the same* immutable file hash.
 * This proves content agreement, not successful audible PA output.
 */
export function assessMchsChannelAudioAgreement(binding,worker,agent){
 if(binding?.verified!==true)return {agreed:false,reason:'EVENT_AUDIO_NOT_VERIFIED'};
 const matches=channel=>channel?.eventId===binding.eventId&&
  channel.assetId===binding.assetId&&channel.sha256===binding.sha256&&
  channel.repeats===binding.repeats;
 if(!matches(worker)||!matches(agent))
  return {agreed:false,reason:'CHANNEL_AUDIO_MISMATCH'};
 return {agreed:true,reason:null,publicPlaybackAuthorized:false};
}
