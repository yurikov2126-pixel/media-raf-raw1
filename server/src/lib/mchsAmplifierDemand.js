/** One fresh, authenticated Worker STATUS response can authorize a bounded
 * MCHS PA demand. It is NOT a voltage measurement or a direct relay command.
 */
const ALARM_TYPES=new Set(['MISSILE_DANGER','MISSILE_ALL_CLEAR']);
export function assessMchsAmplifierDemand(worker){
 const data=worker?.ok===true&&worker?.httpStatus===200?worker.data:null;
 if(!data||data.ok!==true||data.enabled!==true)
  return {active:false,reason:'WORKER_UNAVAILABLE'};
 const session=data.session;
 const matched=ALARM_TYPES.has(session?.eventType)&&
  typeof session?.eventId==='string'&&session.eventId.length>0;
 // Do not hold relay for an old completed session, or arbitrary training audio.
 if(matched&&data.active===true&&['PREEMPTING','PLAYING'].includes(data.phase))
  return {active:true,reason:'MCHS_PCM_ACTIVE',eventId:session.eventId};
 // Pre-roll is reported only as a generic preparing flag. Without event-bound
 // status there is no proof that the prepared work is an actual MCHS alert.
 return {active:false,reason:'NO_ACTIVE_MCHS_PCM'};
}
export function mchsAgentPowerAuthorized(intent,{armed=false,isolated=false,expectedIp}={}){
 return armed===true&&!isolated&&!!intent&&
  intent.permit===true&&intent.policyMode==='MCHS'&&
  intent.reason==='Основное оповещение МЧС'&&
  intent.emergencyOff===false&&
  intent.hardwareExpected==='POWER_CONTROL_V1'&&
  typeof expectedIp==='string'&&intent.esp32Ip===expectedIp;
}
