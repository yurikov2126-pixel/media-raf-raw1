import {classifyMchsObservation} from './mchsClassification.js';

export const MISSILE_TYPES=new Set(['MISSILE_DANGER','MISSILE_ALL_CLEAR']);
/** Bridge provenance is NOT independent confirmation of an official warning. */
export function assessMissileProvenance(input,{allowedChannels=[],region='Тульская область',nowMs=Date.now()}={}){
 const eventType=classifyMchsObservation(input?.title,input?.body);
 const base={eventType,bridgeAuthenticated:true,officiallyVerified:false,automaticPlaybackEnabled:false};
 const reject=reason=>({...base,acceptable:false,reason});
 if(!MISSILE_TYPES.has(eventType))return reject('TYPE_NOT_AUTOMATED');
 if(!Array.isArray(allowedChannels)||!allowedChannels.length)return reject('SOURCE_ALLOWLIST_EMPTY');
 if(typeof input?.channelId!=='string'||!allowedChannels.includes(input.channelId))return reject('CHANNEL_NOT_ALLOWLISTED');
 if(typeof input?.region!=='string'||input.region.trim().toLocaleLowerCase('ru-RU')!==region.toLocaleLowerCase('ru-RU'))return reject('REGION_MISMATCH');
 const time=typeof input?.occurredAt==='string'?Date.parse(input.occurredAt):NaN;
 if(!Number.isFinite(time)||time>nowMs+30000||nowMs-time>120000)return reject('STALE_OR_UNKNOWN_TIME');
 if(typeof input?.eventId!=='string'||!input.eventId)return reject('MISSING_EVENT_ID');
 return {...base,acceptable:true,reason:null};
}
