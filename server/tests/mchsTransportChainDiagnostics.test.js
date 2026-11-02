import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsTransportChain} from '../src/lib/mchsTransportChainDiagnostics.js';
const now=Date.parse('2026-11-02T10:00:00Z');
const base={workerReachable:true,agentTelemetry:{connected:true},trialStop:{status:'LAB_PROCESS_STOP_CONFIRMED'},
 deviceId:'device-1',nowMs:now,esp32Status:{relay1:{reporterId:'device-1',observedAt:new Date(now-1000).toISOString(),agentMode:'CENTRAL',heartbeatFresh:true,leaseValid:true,relayOutputEnabled:false,amplifierPower:'OFF_COMMANDED'}}};
test('healthy telemetry still cannot authorize alarm or PA assertions',()=>{
 const a=assessMchsTransportChain(base);
 assert.equal(a.status,'TELEMETRY_PRESENT_NOT_AUTHORIZED');
 assert.equal(a.dispatchAuthorized,false);assert.equal(a.paOutputVerified,false);
 assert.equal(a.esp32.amplifierPower,'OFF_COMMANDED');
});
test('expired ESP32 telemetry fails closed',()=>{
 const a=assessMchsTransportChain({...base,esp32Status:{relay1:{...base.esp32Status.relay1,observedAt:new Date(now-13000).toISOString()}}});
 assert.equal(a.status,'NOT_READY');assert.ok(a.holds.includes('ESP32_STATUS_STALE_OR_MISSING'));
});
test('unbound reporter never passes power telemetry',()=>{
 const a=assessMchsTransportChain({...base,deviceId:null});
 assert.equal(a.esp32.fresh,false);assert.equal(a.dispatchAuthorized,false);
});
test('worker, agent and trial missing are diagnosed separately',()=>{
 const a=assessMchsTransportChain({...base,workerReachable:false,agentTelemetry:null,trialStop:null});
 assert.ok(a.holds.includes('WORKER_NOT_REACHABLE'));
 assert.ok(a.holds.includes('AGENT_NOT_CONNECTED'));
 assert.ok(a.holds.includes('TRIAL_STOP_NOT_CONFIRMED'));
});
test('multiple relay statuses from same reporter are ambiguous',()=>{
 const a=assessMchsTransportChain({...base,esp32Status:{a:base.esp32Status.relay1,b:base.esp32Status.relay1}});
 assert.ok(a.holds.includes('ESP32_STATUS_AMBIGUOUS'));
});

test('future and malformed telemetry never passes even with recent timestamps',()=>{
 const relay=base.esp32Status.relay1;
 const future=assessMchsTransportChain({...base,esp32Status:{r:{...relay,observedAt:new Date(now+1000).toISOString()}}});
 assert.equal(future.status,'NOT_READY');
 const invalid=assessMchsTransportChain({...base,esp32Status:{r:{...relay,heartbeatFresh:'true'}}});
 assert.equal(invalid.status,'NOT_READY');
 assert.ok(invalid.holds.includes('ESP32_STATUS_INVALID'));
});
test('heartbeat without valid lease is not readiness',()=>{
 const relay=base.esp32Status.relay1;
 const outcome=assessMchsTransportChain({...base,esp32Status:{r:{...relay,leaseValid:false}}});
 assert.ok(outcome.holds.includes('ESP32_NO_VALID_CONTROL_LEASE'));
 assert.equal(outcome.dispatchAuthorized,false);
});
test('disconnected ESP32 reporter is not healthy',()=>{
 const relay=base.esp32Status.relay1;
 const outcome=assessMchsTransportChain({...base,esp32Status:{r:{...relay,agentMode:'DISCONNECTED'}}});
 assert.ok(outcome.holds.includes('ESP32_AGENT_DISCONNECTED'));
});
test('no telemetry after restart must fail closed',()=>{
 const outcome=assessMchsTransportChain({...base,esp32Status:null,agentTelemetry:null,trialStop:null,workerReachable:false});
 assert.equal(outcome.status,'NOT_READY');
 assert.equal(outcome.automaticPlaybackEnabled,false);
});
