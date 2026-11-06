/** Observations from registered Windows Agent; not power authorization. */
const KINDS=new Set(['INTENT_RESPONSE','INTENT_ERROR','POWER_COMMAND','POWER_ERROR','RELAY_TRANSITION']);
const CODE=/^[A-Z][A-Z0-9_]{0,63}$/;
const HEX=/^[a-f0-9]{24}$/;
const MCHS_EVENT_ID=/^[A-Za-z0-9_-]{1,128}$/;
const MAX_EVENTS=150;
export function mergeAgentPowerEvidence(raw,{deviceId,reporterId,observations,nowMs=Date.now()}={}){
 const base=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const events=Array.isArray(base.events)?base.events.slice(-MAX_EVENTS):[];
 if(typeof deviceId!=='string'||!deviceId||typeof reporterId!=='string'||!reporterId||
    !Array.isArray(observations)||observations.length>16)
  return {state:{...base,events},added:[],rejected:true};
 const seen=new Set(events.filter(e=>e?.kind?.startsWith('AGENT_POWER_')).map(e=>e.id));
 const added=[];
 for(const event of observations){
  if(!event||!HEX.test(event.id)||!KINDS.has(event.kind)||seen.has(event.id))continue;
  const atMs=Date.parse(event.at);
  if(!Number.isFinite(atMs)||atMs>nowMs+60000||nowMs-atMs>600000)continue;
  if(event.permit!==undefined&&typeof event.permit!=='boolean')continue;
  if(event.eventId!==undefined&&
     (typeof event.eventId!=='string'||!MCHS_EVENT_ID.test(event.eventId)))continue;
  if(event.httpStatus!==undefined&&(!Number.isInteger(event.httpStatus)||
     event.httpStatus<100||event.httpStatus>599))continue;
  const codes={};let bad=false;
  for(const field of ['reason','transition','phase','errorType']){
   if(event[field]!==undefined){
    if(typeof event[field]!=='string'||!CODE.test(event[field])){bad=true;break;}
    codes[field]=event[field];
   }
  }
  if(bad)continue;
  const entry={id:event.id,deviceId,reporterId,at:new Date(atMs).toISOString(),
   kind:'AGENT_POWER_'+event.kind,detail:codes.reason||codes.transition||codes.errorType||event.kind,
   ...(typeof event.permit==='boolean'?{permit:event.permit}:{}),
   ...(event.httpStatus!==undefined?{httpStatus:event.httpStatus}:{}),
   ...(event.eventId!==undefined?{eventId:event.eventId}:{}),...codes};
  added.push(entry);
  seen.add(event.id);
 }
 return {state:{...base,events:[...events,...added].slice(-MAX_EVENTS)},added,rejected:false};
}
