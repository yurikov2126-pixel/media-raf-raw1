/** Read-only integration check against live service observations. */
export function assessMchsIntegrationProbe({worker=null,agent=null,observer=null,haltReceipt=null,haltEpoch=null,nowMs=Date.now()}={}){
 const holds=[];
 const workerOk=worker?.httpStatus===200 && worker?.data && typeof worker.data==='object';
 if(!workerOk)holds.push('WORKER_READ_PROBE_FAILED');
 const age=value=>{const timestamp=Date.parse(value||'');return Number.isFinite(timestamp)?nowMs-timestamp:null;};
 const heartbeatAgeMs=agent?.lastSeenAt?nowMs-new Date(agent.lastSeenAt).getTime():null;
 const agentOnline=!!agent&&!agent.revokedAt&&agent.playbackAllowed===true&&
  heartbeatAgeMs!==null&&heartbeatAgeMs>=0&&heartbeatAgeMs<=15000;
 if(!agentOnline)holds.push('AGENT_HEARTBEAT_NOT_CURRENT');
 const observerAgeMs=age(observer?.receivedAt);
 const observerFresh=observer?.mode==='OBSERVE_ONLY'&&observerAgeMs!==null&&observerAgeMs>=0&&observerAgeMs<=15000;
 if(!observerFresh)holds.push('AGENT_OBSERVER_UNAVAILABLE');
 const haltAgeMs=age(haltReceipt?.receivedAt);
 const receiptCurrent=typeof haltEpoch==='string'&&haltEpoch.length>0&&haltReceipt?.haltEpoch===haltEpoch&&
  haltReceipt?.receiptOnly===true&&haltAgeMs!==null&&haltAgeMs>=0&&haltAgeMs<=30000;
 if(!receiptCurrent)holds.push('HALT_RECEIPT_MISSING_OR_STALE');
 return {status:holds.length?'INTEGRATION_NOT_CONFIRMED':'READ_ONLY_LINKS_OBSERVED',
  worker:{readProbeOk:!!workerOk},agent:{heartbeatCurrent:agentOnline,observerFresh,
   heartbeatAgeMs,observerAgeMs},halt:{receiptCurrent,receiptAgeMs:haltAgeMs},
  holds,outputStoppedVerified:false,paOutputVerified:false,dispatchAuthorized:false,
  automaticPlaybackEnabled:false,playbackStarted:false};
}
