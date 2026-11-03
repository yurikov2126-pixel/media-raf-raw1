/** Parse device-authenticated Windows VLC session reports.
 * A device token authenticates the reporter, not an officially issued
 * warning or physical PA audibility. Version 1 remains observational-only.
 * Version 2 adds proof of local process-level natural completion as claimed
 * by the Agent; never interpret it as end-to-end audio delivery.
 */
export function normalizeMchsAgentPlaybackReport(body={}){
 const invalid=reason=>({accepted:false,reason});
 if(!body||![1,2].includes(body.version)||
    !['IDLE','STARTING','PLAYING','COMPLETED','STOPPED'].includes(body.state)||
    (body.eventId!==null&&typeof body.eventId!=='string')||
    (typeof body.eventId==='string'&&!/^[A-Za-z0-9_-]{1,128}$/.test(body.eventId))||
    !Number.isInteger(body.completedRepeats)||body.completedRepeats<0||
    body.completedRepeats>5||
    (body.state!=='IDLE'&&typeof body.eventId!=='string'))
  return invalid('INVALID_SESSION_STATUS');
 if(body.version===1){
  return {accepted:true,value:{version:1,eventId:body.eventId,
   state:body.state,completedRepeats:body.completedRepeats,
   expectedRepeats:null,localNaturalCompletionObserved:false,
   processRunning:null,failureReason:null,legacyReport:true}};
 }
 if(!Number.isInteger(body.expectedRepeats)||body.expectedRepeats<0||
    body.expectedRepeats>5||
    (body.state==='IDLE'&&body.expectedRepeats!==0)||
    (body.state!=='IDLE'&&body.expectedRepeats<1)||
    body.completedRepeats>body.expectedRepeats||
    typeof body.processRunning!=='boolean'||
    typeof body.naturalCompletion!=='boolean'||
    (body.failureReason!==null&&
      (typeof body.failureReason!=='string'||
       !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(body.failureReason))))
  return invalid('INVALID_COMPLETION_STATUS');
 if(body.naturalCompletion&&
    (body.state!=='COMPLETED'||body.completedRepeats!==body.expectedRepeats||
     body.processRunning||body.failureReason!==null))
  return invalid('CONTRADICTORY_COMPLETION');
 if(body.state==='COMPLETED'&&!body.naturalCompletion)
  return invalid('COMPLETION_UNCONFIRMED');
 if(body.state==='STARTING'&&body.completedRepeats!==0)
  return invalid('INVALID_START_PROGRESS');
 if(body.state==='IDLE'&&(body.eventId!==null||body.completedRepeats!==0||
    body.processRunning||body.naturalCompletion||body.failureReason!==null))
  return invalid('INVALID_IDLE_REPORT');
 return {accepted:true,value:{version:2,eventId:body.eventId,
  state:body.state,completedRepeats:body.completedRepeats,
  expectedRepeats:body.expectedRepeats,
  localNaturalCompletionObserved:body.naturalCompletion,
  processRunning:body.processRunning,
  failureReason:body.failureReason,legacyReport:false}};
}
