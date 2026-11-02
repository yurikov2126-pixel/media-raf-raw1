import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsDeliveryReceipts} from '../src/lib/mchsDeliveryReceipts.js';
const now=Date.parse('2026-11-02T12:00:03Z');
const envelope={eventId:'event-1',eventType:'MISSILE_DANGER',mode:'NOT_EXECUTABLE',issuedAt:'2026-11-02T12:00:00Z',expiresAt:'2026-11-02T12:00:05Z'};
const workerReceipt={eventId:'event-1',eventType:'MISSILE_DANGER',observedAt:'2026-11-02T12:00:01Z'};
const agentReceipt={eventId:'event-1',eventType:'MISSILE_DANGER',observedAt:'2026-11-02T12:00:02Z'};
test('two correlated acknowledgements do not authorize public or physical sound',()=>{
 const r=assessMchsDeliveryReceipts({envelope,workerReceipt,agentReceipt,nowMs:now});
 assert.equal(r.correlated,true);assert.equal(r.publicPlaybackAuthorized,false);
 assert.equal(r.amplifierAuthorized,false);assert.equal(r.audioAudibilityVerified,false);
});
test('missing Agent, wrong event and expired envelope are rejected',()=>{
 for(const patch of [{agentReceipt:null},{workerReceipt:{...workerReceipt,eventId:'other'}},{nowMs:now+5000}]){
  const r=assessMchsDeliveryReceipts({envelope,workerReceipt,agentReceipt,nowMs:now,...patch});
  assert.equal(r.correlated,false);assert.ok(r.holds.length);
 }
});
test('fresh-looking receipt from future is rejected',()=>{
 const r=assessMchsDeliveryReceipts({envelope,workerReceipt,agentReceipt:{...agentReceipt,observedAt:'2026-11-02T12:01:00Z'},nowMs:now});
 assert.equal(r.correlated,false);
});
