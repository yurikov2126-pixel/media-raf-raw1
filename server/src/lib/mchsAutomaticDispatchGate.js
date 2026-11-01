import {classifyMchsObservation} from './mchsClassification.js';

/** Pure decision gate for future automatic MCHS playback.
 * Never treats text classification or authenticated relay as official verification.
 * Returned commands are decisions only, not radio commands.
 */
export function decideAutomaticMchsEvent({event,rule,asset,provenance,nowMs=Date.now(),seenIds=new Set(),activeIncident=null,enabled=false}={}){
 const kind=classifyMchsObservation(event?.title,event?.body);
 const id=event?.sourceEventId;
 const at=event?.occurredAt?new Date(event.occurredAt).getTime():NaN;
 const ageMs=Number.isFinite(at)?nowMs-at:null;
 const blocked=[];
 if(!enabled)blocked.push('AUTOMATIC_DISPATCH_DISABLED');
 if(typeof id!=='string'||!id.trim()||seenIds.has(id))blocked.push('DUPLICATE_OR_MISSING_ID');
 if(kind==='UNCLASSIFIED')blocked.push('UNCLASSIFIED');
 if(ageMs===null||ageMs< -120000||ageMs>120000)blocked.push('STALE_OR_UNKNOWN_TIME');
 if(!event?.region||!/ТУЛЬСК/i.test(event.region))blocked.push('REGION_UNVERIFIED');
 // A valid HMAC from the Android observer authenticates transport, NOT the
 // originating government publication. Provenance must be independently proven.
 if(provenance?.officialVerified!==true || provenance?.verifiedSourceEventId!==id)
  blocked.push('OFFICIAL_ORIGIN_NOT_VERIFIED');
 if(rule?.mode!=='AUTO')blocked.push('RULE_NOT_AUTO');
 if(!asset||asset.id!==rule?.audioAssetId||asset.category!=='ALARM'||!asset.mimeType?.startsWith('audio/'))
  blocked.push('ALARM_ASSET_INVALID');
 const clear=kind==='UAV_ALL_CLEAR'||kind==='MISSILE_ALL_CLEAR';
 const hazard=kind.startsWith('UAV_')?'UAV':kind.startsWith('MISSILE_')?'MISSILE':null;
 if(clear&&(!activeIncident||activeIncident.hazard!==hazard))blocked.push('NO_MATCHING_ACTIVE_INCIDENT');
 if(!clear&&activeIncident)blocked.push('INCIDENT_ALREADY_ACTIVE');
 return {action:blocked.length?'BLOCK':clear?'STOP':'START',eventType:kind,sourceEventId:id||null,
  assetId:blocked.length?null:asset.id,reasonCodes:blocked,executable:false};
}
