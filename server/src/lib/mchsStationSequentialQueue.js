import {validateMchsStationCommand} from './mchsStationCommandContract.js';

const RETRYABLE=new Set(['STATION_SOURCE_BUSY','STATION_PREPARING']);
export const MCHS_QUEUE_CLAIM_TTL_MS=30000;

/** Pure persistent ledger selection: one earliest fresh command at a time.
 * A previous uncertain DISPATCHING may not be retried without Worker evidence.
 */
export function selectNextMchsStationIntent(raw,{nowMs=Date.now(),workerStatus}={}){
 const items=Array.isArray(raw?.items)?raw.items:[];
 const updated=items.map(item=>({...item}));
 let changed=false;
 for(const item of updated){
  if(!['STAGED','QUEUED'].includes(item.status))continue;
  const occurredAt=item.occurredAt||item.createdAt;
  const valid=validateMchsStationCommand({action:'START',eventId:item.eventId,
   eventType:item.eventType,assetId:item.assetId,repeats:item.repetitions,
   occurredAt,admittedAt:item.createdAt},{nowMs});
  if(!valid.ok){
   item.status='EXPIRED';item.lastError=valid.reason;changed=true;
  }
 }
 const live=workerStatus?.ok===true&&workerStatus.data?.ok!==false&&
   workerStatus.data?.terminalJournal?.healthy!==false;
 const phase=workerStatus?.data?.phase;
 const busy=Boolean(workerStatus?.data?.preparing||workerStatus?.data?.active||
   ['PREEMPTING','PLAYING','RESUMING'].includes(phase));
 const candidate=updated.filter(item=>['STAGED','QUEUED'].includes(item.status))
  .sort((a,b)=>Date.parse(a.occurredAt||a.createdAt)-Date.parse(b.occurredAt||b.createdAt))[0]||null;
 return {items:updated,changed,candidate:live&&!busy?candidate:null,
  blocked:!live?'WORKER_STATUS_UNAVAILABLE':busy?'WORKER_BUSY':null};
}
export function settleMchsStationAttempt(item,response,{now=new Date().toISOString()}={}){
 if(item?.status!=='DISPATCHING')throw new Error('NOT_DISPATCHING');
 const data=response?.data||{};
 const accepted=response?.ok===true;
 const reason=accepted?null:data.reason||response?.reason||'WORKER_UNCONFIRMED';
 const busy=response?.httpStatus===409&&RETRYABLE.has(reason);
 const ambiguous=!accepted&&!busy&&
  ['WORKER_TIMEOUT','WORKER_TRANSPORT_ERROR','NO_WORKER_RESULT','WORKER_UNCONFIRMED'].includes(reason);
 return {...item,status:accepted?'START_ACCEPTED':busy?'QUEUED':ambiguous?'DISPATCHING':'START_REJECTED',
  lastAttemptAt:now,lastError:reason,updatedAt:now};
}
