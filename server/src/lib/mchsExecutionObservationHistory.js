/** Bounded execution observation history; diagnostic only, not event dispatch. */
export const EXECUTION_HISTORY_LIMIT=50;
export function appendMchsExecutionObservation(history, observation, receivedAt){
 if(!Array.isArray(history))history=[];
 if(!observation||typeof observation!=='object'||typeof receivedAt!=='string')
  throw new TypeError('INVALID_EXECUTION_OBSERVATION');
 const entry={...observation,receivedAt,
   localProcessObservationOnly:true,physicalPaOutputVerified:false,
   publicPlaybackAuthorized:false};
 // Latest truthful state for one device event replaces its previous snapshot.
 const items=history.filter(item=>item&&item.eventId!==entry.eventId);
 items.push(entry);
 return items.slice(-EXECUTION_HISTORY_LIMIT);
}
export function readMchsExecutionObservationHistory(raw){
 let data;
 try{data=JSON.parse(raw||'[]');}catch{return [];}
 if(!Array.isArray(data))return [];
 return data.filter(entry=>entry&&typeof entry==='object'&&
     typeof entry.eventId==='string'&&
     ['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(entry.eventType)&&
     ['COMPLETE','FAILED'].includes(entry.phase)&&
     typeof entry.receivedAt==='string')
   .slice(-EXECUTION_HISTORY_LIMIT)
   .map(item=>({...item,localProcessObservationOnly:true,
        physicalPaOutputVerified:false,publicPlaybackAuthorized:false}));
}

/** Read legacy #975 one-event observation when the #976 history is empty.
 * Never synthesize event delivery or PA output; require server-normalized data.
 */
export function mergeLegacyMchsExecutionObservation(history,legacyRaw){
 const result=readMchsExecutionObservationHistory(JSON.stringify(history));
 let legacy;
 try{legacy=JSON.parse(legacyRaw||'null');}catch{return result;}
 if(!legacy||typeof legacy!=='object'||Array.isArray(legacy))return result;
 if(!['COMPLETE','FAILED'].includes(legacy.phase)||
    !['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(legacy.eventType)||
    typeof legacy.eventId!=='string'||!legacy.eventId||
    typeof legacy.receivedAt!=='string'||!Number.isSafeInteger(legacy.expectedRepeats)||
    !Number.isSafeInteger(legacy.completedRepeats)||
    typeof legacy.naturalCompletion!=='boolean'||
    typeof legacy.centralReturnConfirmed!=='boolean')return result;
 if(result.some(item=>item.eventId===legacy.eventId))return result;
 return readMchsExecutionObservationHistory(
  JSON.stringify([legacy,...result].slice(-EXECUTION_HISTORY_LIMIT)));
}
