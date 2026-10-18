import fs from 'node:fs/promises';
import path from 'node:path';
import { reserveCrossfadePair, safeCrossfadeDuration } from './radioQueueCrossfade.js';
/** Read-only file preflight: never open an audio output or launch an FFmpeg decoder. */
export async function preflightNextTracks({items,history=[],cooldownMinutes=0,nowMs=Date.now(),
 preferredId=null,requestedMs=0,untilMs=Infinity,assetsRoot,access=fs.access}){
 const reservation=reserveCrossfadePair(items,history,cooldownMinutes,nowMs,preferredId);
 const result={status:reservation.status,firstId:reservation.first?.id||null,
  secondId:reservation.second?.id||null,overlapMs:0,ready:false};
 if(!reservation.first)return result;
 const present=async asset=>{
  if(!asset?.storageKey||!assetsRoot)return false;
  try{await access(path.join(assetsRoot,path.basename(asset.storageKey)));return true;}catch{return false;}
 };
 if(!await present(reservation.first))return {...result,status:'FIRST_MISSING'};
 if(!reservation.second)return {...result,status:'SOLO',ready:true};
 if(!await present(reservation.second))return {...result,status:'SECOND_MISSING',secondId:null,ready:true};
 const overlapMs=safeCrossfadeDuration(reservation.first,reservation.second,requestedMs,untilMs,nowMs);
 return {...result,status:overlapMs?'READY':'SOLO',secondId:overlapMs?reservation.second.id:null,
  overlapMs,ready:true};
}
