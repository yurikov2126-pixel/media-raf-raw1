/** Device-reported isolated headphone readiness is diagnostic, not physical PA evidence. */
const DIGEST=/^[a-f0-9]{64}$/;
export const MCHS_AGENT_READY_TTL_MS=30000;

export function normalizeMchsAgentReadiness(input){
 if(!input||input.version!==1||input.mode!=='ISOLATED_EVENT_AUDIO'||
    input.operatorIsolationAttested!==true||
    typeof input.centralPacketsConfirmed!=='boolean'||
    !input.assets||typeof input.assets!=='object'||
    !DIGEST.test(input.assets.MISSILE_DANGER||'')||
    !DIGEST.test(input.assets.MISSILE_ALL_CLEAR||'')||
    input.assets.MISSILE_DANGER===input.assets.MISSILE_ALL_CLEAR)
  return {ok:false,reason:'INVALID_ISOLATED_AGENT_READINESS'};
 return {ok:true,value:{
  version:1,mode:'ISOLATED_EVENT_AUDIO',
  operatorIsolationAttested:true,
  centralPacketsConfirmed:input.centralPacketsConfirmed,
  assets:{MISSILE_DANGER:input.assets.MISSILE_DANGER,
   MISSILE_ALL_CLEAR:input.assets.MISSILE_ALL_CLEAR},
  physicalPaVerified:false,publicPlaybackAuthorized:false
 }};
}

export function readMchsAgentReadiness(raw,{nowMs=Date.now()}={}){
 let data=raw;
 if(typeof data==='string'){try{data=JSON.parse(data);}catch{return null;}}
 const validated=normalizeMchsAgentReadiness(data);
 if(!validated.ok)return null;
 const receivedAt=Date.parse(data.receivedAt||'');
 if(!Number.isFinite(receivedAt)||receivedAt>nowMs||
    nowMs-receivedAt>MCHS_AGENT_READY_TTL_MS)return null;
 return {...validated.value,receivedAt:data.receivedAt,fresh:true};
}
