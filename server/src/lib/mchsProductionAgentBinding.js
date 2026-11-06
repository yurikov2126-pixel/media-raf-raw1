/** Resolve the exact Windows Radio Agent used for main-station diagnostics.
 * Never infer an Agent from the most recently connected device.
 * A legacy lab binding may remain visible during migration, but is labelled.
 */
export function resolveMchsProductionAgentBinding(env={}){
 const production=(env.MCHS_MAIN_STATION_AGENT_DEVICE_ID||'').trim();
 const legacy=(env.MCHS_AGENT_LAB_DEVICE_ID||'').trim();
 if(production)return {deviceId:production,source:'PRODUCTION_EXPLICIT',legacy:false,configured:true};
 if(legacy)return {deviceId:legacy,source:'LEGACY_LAB_FALLBACK',legacy:true,configured:false};
 return {deviceId:null,source:'UNCONFIGURED',legacy:false,configured:false};
}
export function selectMchsBoundEsp32Evidence(raw,{deviceId,nowMs=Date.now(),freshMs=12000}={}){
 const entries=Object.entries(raw?.devices||{}).filter(([id,v])=>
  id&&v&&v.reporterId===deviceId);
 if(!deviceId||entries.length===0)
  return {deviceId:null,reason:'NO_BOUND_ESP32',ambiguous:false};
 const fresh=entries.filter(([,v])=>{
  const at=Date.parse(v.observedAt||'');
  return Number.isFinite(at)&&nowMs>=at&&nowMs-at<=freshMs;
 });
 if(fresh.length!==1)
  return {deviceId:null,reason:fresh.length>1?'AMBIGUOUS_FRESH_ESP32':
   'NO_FRESH_ESP32',ambiguous:fresh.length>1};
 return {deviceId:fresh[0][0],reason:null,ambiguous:false};
}
