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
