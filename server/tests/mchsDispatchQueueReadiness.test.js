import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsDispatchQueue} from '../src/lib/mchsDispatchQueueReadiness.js';
const now=Date.parse('2026-11-02T10:00:00Z');
const x={sourceEventId:'id1',status:'STAGED',eventType:'MISSILE_DANGER',assetId:'alarm',repetitions:3,dispatchAuthorized:false,createdAt:new Date(now-1000).toISOString()};
test('dispatch never enabled even if dependencies report readiness',()=>{
 const report=assessMchsDispatchQueue({items:[x]},{operatorHold:false,workerReady:true,agentReady:true,nowMs:now});
 assert.equal(report.dispatchAuthorized,false);assert.equal(report.decisions[0].ready,false);
 assert.deepEqual(report.decisions[0].holds,['AUTOMATIC_DISPATCH_DISABLED']);
});
test('missing assets, expired and unconfirmed agent are visible',()=>{
 const report=assessMchsDispatchQueue({items:[{...x,assetId:null,createdAt:new Date(now-200000).toISOString()}]},{nowMs:now});
 assert.ok(report.decisions[0].holds.includes('ASSET_NOT_CONFIGURED'));
 assert.ok(report.decisions[0].holds.includes('INTENT_EXPIRED'));
 assert.ok(report.decisions[0].holds.includes('AGENT_NOT_READY'));
});
