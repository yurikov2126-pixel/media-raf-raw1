import {agentHeartbeatState} from './radioAgentHeartbeat.js';

/** Read-only evidence for the actual station path; no source may self-authorize PA. */
export function assessMchsMainStationReadiness({
 worker=null,device=null,esp32Status=null,receipts=null,
 flags={},deviceId=null,nowMs=Date.now()
}={}){
 const checks=[],hold=(name,ok,reason)=>checks.push({
  name,ok:ok===true,reason:ok===true?null:reason
 });
 const status=worker?.ok===true?worker.data:null;
 hold('workerReachable',!!status,'RADIO_WORKER_UNAVAILABLE');
 hold('workerPcmJournal',status?.terminalJournal?.healthy===true,
  'PCM_TERMINAL_JOURNAL_NOT_HEALTHY');
 const stationPhase=status?.phase||'UNKNOWN';
 const stationBusy=Boolean(status?.active||status?.preparing||
  ['PREEMPTING','PLAYING','RESUMING'].includes(stationPhase));
 hold('workerIdle',!!status&&!stationBusy,'PCM_SESSION_ACTIVE_OR_UNKNOWN');
 const agent=device?agentHeartbeatState(device,nowMs):null;
 hold('windowsAgent',agent?.status==='ONLINE'&&agent?.playbackAllowed===true,
  'WINDOWS_AGENT_NOT_ONLINE_OR_UNAUTHORIZED');
 const eps=esp32Status&&typeof esp32Status==='object'?Object.values(esp32Status).filter(x=>
  x&&x.reporterId===deviceId&&Number.isFinite(Date.parse(x.observedAt||''))&&
  nowMs-Date.parse(x.observedAt)>=0&&nowMs-Date.parse(x.observedAt)<=12000):[];
 const esp=eps.length===1?eps[0]:null;
 hold('esp32Telemetry',!!esp,'ESP32_TELEMETRY_STALE_MISSING_OR_AMBIGUOUS');
 hold('esp32Heartbeat',esp?.heartbeatFresh===true,'ESP32_HEARTBEAT_UNVERIFIED');
 hold('esp32Lease',esp?.leaseValid===true,'ESP32_RELAY_LEASE_UNVERIFIED');
 hold('esp32RelayMode',esp?.relayOutputEnabled===true&&
  ['OFF_COMMANDED','ON_COMMANDED'].includes(esp?.amplifierPower),
  'ESP32_RELAY_STATE_UNVERIFIED');
 // Last successful PCM receipt proves only input to MP3 encoder, not headphones.
 const rows=Array.isArray(receipts?.items)?receipts.items:[];
 const confirmed=rows.filter(x=>x.state==='COMPLETE'&&x.naturalCompletion===true&&
  x.programRestored===true&&x.preemptAcknowledged===true);
 const latest=confirmed.at(-1)||null;
 hold('encoderPcmEvidence',!!latest,'NO_COMPLETE_STATION_PCM_RECEIPT');
 // Cannot infer physical power stability from one ESP32 status snapshot.
 hold('agentAudibility',false,'WINDOWS_AUDIO_NOT_INDEPENDENTLY_VERIFIED');
 hold('amplifierStability',false,'AMPLIFIER_NO_DROPOUT_EVIDENCE_MISSING');
 hold('speakerAudibility',false,'PA_AUDIBILITY_NOT_INDEPENDENTLY_VERIFIED');
 const configured=flags.dispatch===true&&flags.coordinator===true&&flags.workerCommands===true;
 return {readOnly:true,status:'HOLD',readyForLivePA:false,physicalOutputConfirmed:false,
  commandDispatchConfigured:configured,flags:{
   androidDispatch:flags.dispatch===true,coordinator:flags.coordinator===true,
   workerCommands:flags.workerCommands===true
  },worker:{reachable:!!status,phase:stationPhase,busy:stationBusy,
   journalHealthy:status?.terminalJournal?.healthy===true},
  agent:{deviceBound:!!deviceId,online:agent?.status==='ONLINE',
   playbackAllowed:agent?.playbackAllowed===true,heartbeatAgeMs:agent?.ageMs??null},
  esp32:{fresh:!!esp,heartbeatFresh:esp?.heartbeatFresh===true,
   leaseValid:esp?.leaseValid===true,amplifierPower:esp?.amplifierPower||'UNKNOWN',
   relayOnTransitions:Number.isSafeInteger(esp?.relayOnTransitions)?esp.relayOnTransitions:null,
   relayOffTransitions:Number.isSafeInteger(esp?.relayOffTransitions)?esp.relayOffTransitions:null,
   lastRelayOffReason:typeof esp?.lastRelayOffReason==='string'?esp.lastRelayOffReason:null,
   lastRelayTransitionMs:Number.isSafeInteger(esp?.lastRelayTransitionMs)?esp.lastRelayTransitionMs:null,
   firmwareEvidencePresent:!!esp&&Number.isSafeInteger(esp.relayOnTransitions)&&
    Number.isSafeInteger(esp.relayOffTransitions)},
  stationReceipt:{confirmedCount:confirmed.length,lastEventId:latest?.eventId||null},
  checks,holds:checks.filter(c=>!c.ok).map(c=>c.reason)};
}
