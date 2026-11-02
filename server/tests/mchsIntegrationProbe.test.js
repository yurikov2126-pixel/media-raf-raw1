import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsIntegrationProbe} from '../src/lib/mchsIntegrationProbe.js';
const now=Date.parse('2026-11-02T10:00:00Z');
const base={nowMs:now,worker:{httpStatus:200,data:{phase:'IDLE'}},
 agent:{lastSeenAt:new Date(now-1000),playbackAllowed:true,revokedAt:null},
 observer:{mode:'OBSERVE_ONLY',receivedAt:new Date(now-1000).toISOString()},
 haltEpoch:new Date(now-5000).toISOString(),
 haltReceipt:{haltEpoch:new Date(now-5000).toISOString(),receivedAt:new Date(now-1000).toISOString(),receiptOnly:true}};
test('fresh link observations never authorize playback or claim PA silence',()=>{
 const r=assessMchsIntegrationProbe(base);
 assert.equal(r.status,'READ_ONLY_LINKS_OBSERVED');
 assert.equal(r.dispatchAuthorized,false);
 assert.equal(r.paOutputVerified,false);
 assert.equal(r.outputStoppedVerified,false);
});
test('Worker failure is distinguished from agent timeout',()=>{
 const worker=assessMchsIntegrationProbe({...base,worker:null});
 assert.ok(worker.holds.includes('WORKER_READ_PROBE_FAILED'));
 const agent=assessMchsIntegrationProbe({...base,agent:{...base.agent,lastSeenAt:new Date(now-18000)}});
 assert.ok(agent.holds.includes('AGENT_HEARTBEAT_NOT_CURRENT'));
});
test('stale observer and delayed receipt do not confirm integration',()=>{
 const r=assessMchsIntegrationProbe({...base,observer:{...base.observer,receivedAt:new Date(now-16000).toISOString()},
 haltReceipt:{...base.haltReceipt,receivedAt:new Date(now-31000).toISOString()}});
 assert.ok(r.holds.includes('AGENT_OBSERVER_UNAVAILABLE'));
 assert.ok(r.holds.includes('HALT_RECEIPT_MISSING_OR_STALE'));
});
test('restarted server with no retained observations fails closed',()=>{
 const r=assessMchsIntegrationProbe({nowMs:now});
 assert.equal(r.status,'INTEGRATION_NOT_CONFIRMED');
 assert.equal(r.automaticPlaybackEnabled,false);
});
test('receipt for earlier HALT epoch cannot validate current HALT',()=>{
 const r=assessMchsIntegrationProbe({...base,haltEpoch:new Date(now-100).toISOString()});
 assert.equal(r.halt.receiptCurrent,false);
 assert.equal(r.playbackStarted,false);
});
