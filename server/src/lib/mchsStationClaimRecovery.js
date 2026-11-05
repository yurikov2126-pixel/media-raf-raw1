/** Recover a previously claimed command only from matching Worker evidence.
 * Absence is not proof it never played, so never auto-replay an uncertain START.
 */
export function reconcileMchsStationClaims(items,workerStatus,{nowMs=Date.now(),uncertainAfterMs=30000}={}){
 const rows=(Array.isArray(items)?items:[]).map(item=>({...item}));
 if(workerStatus?.ok!==true||workerStatus?.data?.ok===false||
    workerStatus?.data?.terminalJournal?.healthy!==true)
  return {items:rows,changed:false,recovered:[],reason:'WORKER_EVIDENCE_UNAVAILABLE'};
 const data=workerStatus.data;
 const evidence=new Set([
  ...(Array.isArray(data.terminalHistory)?data.terminalHistory.map(x=>x?.eventId):[]),
  data.session?.eventId
 ].filter(x=>typeof x==='string'));
 const recovered=[];
 let changed=false;
 for(const item of rows){
  if(item.status!=='DISPATCHING')continue;
  if(evidence.has(item.eventId)){
   item.status='START_ACCEPTED';item.lastError=null;
   item.updatedAt=new Date(nowMs).toISOString();
   recovered.push({eventId:item.eventId,eventType:item.eventType,ok:true});
   changed=true;
  }else{
   const claimed=Date.parse(item.claimedAt||'');
   if(Number.isFinite(claimed)&&nowMs-claimed>=uncertainAfterMs){
    item.status='UNKNOWN';item.lastError='UNCONFIRMED_START_AFTER_RESTART';
    item.updatedAt=new Date(nowMs).toISOString();
    changed=true;
   }
  }
 }
 return {items:rows,changed,recovered,reason:null};
}
