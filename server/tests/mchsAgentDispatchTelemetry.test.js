import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsAgentDispatchTelemetry} from '../src/lib/mchsAgentDispatchTelemetry.js';

const now=Date.parse('2026-11-02T10:00:00Z');
const device={id:'pilot-1',name:'Windows pilot',lastSeenAt:new Date(now-1000),revokedAt:null,playbackAllowed:true};
const observer={mode:'OBSERVE_ONLY',receivedAt:new Date(now-1000).toISOString(),code:'OBSERVABLE_ONLY',primaryAlive:true,reserveAlive:false};
test('healthy pilot telemetry remains non-authoritative for PA output',()=>{
 const r=assessMchsAgentDispatchTelemetry(device,observer,now);
 assert.equal(r.connected,true);assert.equal(r.observerFresh,true);
 assert.equal(r.confirmed,false);assert.equal(r.audioOutputVerified,false);
 assert.ok(r.holds.includes('AGENT_AUDIO_OUTPUT_UNVERIFIED'));
});
test('unbound device cannot be impersonated by observer data',()=>{
 const r=assessMchsAgentDispatchTelemetry(null,observer,now);
 assert.equal(r.confirmed,false);assert.deepEqual(r.holds,['AGENT_DEVICE_NOT_BOUND']);
});
test('stale heartbeat and stale observer are diagnosed independently',()=>{
 const r=assessMchsAgentDispatchTelemetry({...device,lastSeenAt:new Date(now-60000)},
  {...observer,receivedAt:new Date(now-20000).toISOString()},now);
 assert.equal(r.connected,false);assert.equal(r.observerFresh,false);
 assert.ok(r.holds.includes('AGENT_HEARTBEAT_STALE'));
 assert.ok(r.holds.includes('AGENT_OBSERVER_STALE'));
});
test('revoked device and disabled playback cannot pass readiness',()=>{
 const r=assessMchsAgentDispatchTelemetry({...device,revokedAt:new Date(),playbackAllowed:false},observer,now);
 assert.ok(r.holds.includes('AGENT_REVOKED'));
 assert.ok(r.holds.includes('AGENT_PLAYBACK_NOT_ALLOWED'));
 assert.equal(r.confirmed,false);
});
test('future observer timestamp is rejected',()=>{
 const r=assessMchsAgentDispatchTelemetry(device,{...observer,receivedAt:new Date(now+1000).toISOString()},now);
 assert.equal(r.observerFresh,false);
});
