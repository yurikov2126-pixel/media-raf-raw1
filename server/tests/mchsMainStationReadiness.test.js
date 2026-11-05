import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsMainStationReadiness} from '../src/lib/mchsMainStationReadiness.js';
const nowMs=Date.parse('2026-11-05T20:40:00.000Z');
const status={ok:true,data:{ok:true,enabled:false,phase:'COMPLETE',
 active:false,preparing:false,terminalJournal:{healthy:true}}};
const device={id:'agent1',name:'Radio Agent',lastSeenAt:new Date(nowMs-1000),
 revokedAt:null,playbackAllowed:true};
const esp={'esp1':{reporterId:'agent1',observedAt:new Date(nowMs-500).toISOString(),
 heartbeatFresh:true,leaseValid:true,relayOutputEnabled:true,
 amplifierPower:'ON_COMMANDED'}};
const receipts={items:[{eventId:'alarm1',state:'COMPLETE',
 naturalCompletion:true,programRestored:true,preemptAcknowledged:true}]};
test('healthy transport cannot claim PA audible or authorize relay',()=>{
 const r=assessMchsMainStationReadiness({
  worker:status,device,esp32Status:esp,receipts,deviceId:'agent1',nowMs});
 assert.equal(r.worker.journalHealthy,true);
 assert.equal(r.agent.online,true);
 assert.equal(r.esp32.fresh,true);
 assert.equal(r.stationReceipt.confirmedCount,1);
 assert.equal(r.status,'HOLD');
 assert.equal(r.readyForLivePA,false);
 assert.equal(r.physicalOutputConfirmed,false);
 assert.ok(r.holds.includes('AMPLIFIER_NO_DROPOUT_EVIDENCE_MISSING'));
 assert.ok(r.holds.includes('PA_AUDIBILITY_NOT_INDEPENDENTLY_VERIFIED'));
});
test('stale Agent and stale ESP32 cannot look healthy',()=>{
 const r=assessMchsMainStationReadiness({
  worker:status,device:{...device,lastSeenAt:new Date(nowMs-60000)},
  esp32Status:{esp1:{...esp.esp1,observedAt:new Date(nowMs-15000).toISOString()}},
  deviceId:'agent1',nowMs});
 assert.equal(r.agent.online,false);
 assert.equal(r.esp32.fresh,false);
 assert.ok(r.holds.includes('ESP32_TELEMETRY_STALE_MISSING_OR_AMBIGUOUS'));
});
test('unhealthy durable Worker terminal log blocks positive status',()=>{
 const r=assessMchsMainStationReadiness({
  worker:{ok:true,data:{...status.data,terminalJournal:{healthy:false}}},
  device,esp32Status:esp,receipts,deviceId:'agent1',nowMs});
 assert.equal(r.worker.journalHealthy,false);
 assert.ok(r.holds.includes('PCM_TERMINAL_JOURNAL_NOT_HEALTHY'));
});
test('active PCM session is not idle even with healthy journal',()=>{
 const r=assessMchsMainStationReadiness({
  worker:{ok:true,data:{...status.data,phase:'PLAYING',active:true}},
  device,esp32Status:esp,deviceId:'agent1',nowMs});
 assert.equal(r.worker.busy,true);
 assert.ok(r.holds.includes('PCM_SESSION_ACTIVE_OR_UNKNOWN'));
});
test('multiple fresh ESP32 reports by same device must be treated as ambiguous',()=>{
 const r=assessMchsMainStationReadiness({
  worker:status,device,deviceId:'agent1',nowMs,
  esp32Status:{one:esp.esp1,two:{...esp.esp1}}});
 assert.equal(r.esp32.fresh,false);
});
test('enabled command flags alone cannot remove unresolved audio holds',()=>{
 const r=assessMchsMainStationReadiness({worker:status,device,esp32Status:esp,
  receipts,deviceId:'agent1',nowMs,flags:{dispatch:true,coordinator:true,workerCommands:true}});
 assert.equal(r.commandDispatchConfigured,true);
 assert.equal(r.readyForLivePA,false);
});
test('missing bound Agent gives a clear blocker rather than infer it from another device',()=>{
 const r=assessMchsMainStationReadiness({
  worker:status,device:null,esp32Status:esp,receipts,nowMs});
 assert.equal(r.agent.deviceBound,false);
 assert.equal(r.esp32.fresh,false);
 assert.ok(r.holds.includes('WINDOWS_AGENT_NOT_ONLINE_OR_UNAUTHORIZED'));
});

test('read-only station readiness reveals firmware GPIO13 OFF reason and counters',()=>{
 const extended={esp1:{...esp.esp1,relayOnTransitions:8,relayOffTransitions:7,
  lastRelayOffReason:'POWER_LEASE_EXPIRED',lastRelayTransitionMs:123456}};
 const r=assessMchsMainStationReadiness({worker:status,device,
  esp32Status:extended,deviceId:'agent1',nowMs});
 assert.equal(r.esp32.firmwareEvidencePresent,true);
 assert.equal(r.esp32.relayOnTransitions,8);
 assert.equal(r.esp32.relayOffTransitions,7);
 assert.equal(r.esp32.lastRelayOffReason,'POWER_LEASE_EXPIRED');
 assert.equal(r.readyForLivePA,false);
 assert.equal(r.physicalOutputConfirmed,false);
});
test('legacy ESP32 telemetry shows no firmware counters without guessing',()=>{
 const r=assessMchsMainStationReadiness({worker:status,device,
  esp32Status:esp,deviceId:'agent1',nowMs});
 assert.equal(r.esp32.firmwareEvidencePresent,false);
 assert.equal(r.esp32.relayOnTransitions,null);
 assert.equal(r.esp32.lastRelayOffReason,null);
});
