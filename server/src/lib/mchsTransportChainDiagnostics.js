/** MCHS read-only chain diagnostics; telemetry never proves audible PA output. */
export const MCHS_ESP32_TTL_MS=12000;
export function assessMchsTransportChain({workerReachable=false,agentTelemetry=null,trialStop=null,esp32Status=null,deviceId=null,nowMs=Date.now()}={}){
 const holds=[];
 if(!workerReachable)holds.push('WORKER_NOT_REACHABLE');
 if(agentTelemetry?.connected!==true)holds.push('AGENT_NOT_CONNECTED');
 const trialStatus=trialStop?.status||'STOP_NOT_CONFIRMED';
 if(trialStatus!=='LAB_PROCESS_STOP_CONFIRMED')holds.push('TRIAL_STOP_NOT_CONFIRMED');
 const entries=esp32Status&&typeof esp32Status==='object'&&!Array.isArray(esp32Status)
  ?Object.values(esp32Status).filter(x=>x&&typeof x==='object'&&
     (deviceId?x.reporterId===deviceId:false)):[];
 const fresh=entries.filter(x=>{const t=Date.parse(x.observedAt||'');const age=nowMs-t;
  return Number.isFinite(t)&&age>=0&&age<=MCHS_ESP32_TTL_MS;});
 const powerTelemetry=fresh.length===1?fresh[0]:null;
 if(fresh.length===0)holds.push('ESP32_STATUS_STALE_OR_MISSING');
 if(fresh.length>1)holds.push('ESP32_STATUS_AMBIGUOUS');
 if(powerTelemetry?.heartbeatFresh!==true)holds.push('ESP32_HEARTBEAT_NOT_CONFIRMED');
 if(powerTelemetry?.leaseValid!==true)holds.push('ESP32_LEASE_NOT_CONFIRMED');
 return {status:holds.length?'NOT_READY':'TELEMETRY_PRESENT_NOT_AUTHORIZED',
  worker:{reachable:workerReachable},
  agent:{connected:agentTelemetry?.connected===true,deviceBound:!!deviceId},
  trial:{status:trialStatus},
  esp32:{fresh:!!powerTelemetry,heartbeatFresh:powerTelemetry?.heartbeatFresh===true,
   leaseValid:powerTelemetry?.leaseValid===true,relayOutputEnabled:powerTelemetry?.relayOutputEnabled??null,
   amplifierPower:powerTelemetry?.amplifierPower||'UNKNOWN'},
  holds:[...holds,'PA_OUTPUT_NOT_INDEPENDENTLY_VERIFIED'],
  paOutputVerified:false,dispatchAuthorized:false,automaticPlaybackEnabled:false};
}
