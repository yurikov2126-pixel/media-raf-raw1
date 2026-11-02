import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMchsEventReceipt} from '../src/lib/mchsEventReceiptEvidence.js';
const now=Date.parse('2026-11-02T12:00:00Z');
const base={eventId:'e1',eventType:'MISSILE_DANGER',receiptOnly:true,status:'RECEIVED',observedAt:'2026-11-02T11:59:59Z'};
test('event receipt must match event and be recent',()=>{
 const r=normalizeMchsEventReceipt(base,{eventId:'e1',eventType:'MISSILE_DANGER',nowMs:now});
 assert.equal(r.reason,null);assert.equal(r.receipt.eventId,'e1');
});
test('heartbeat-style and stale evidence cannot pass as ACK',()=>{
 for(const bad of [{...base,receiptOnly:false},{...base,status:'CONNECTED'},{...base,eventId:'other'},{...base,observedAt:'2026-11-02T11:59:00Z'},{...base,observedAt:'2026-11-02T12:00:01Z'}]){
  assert.equal(normalizeMchsEventReceipt(bad,{eventId:'e1',eventType:'MISSILE_DANGER',nowMs:now}).receipt,null);
 }
});
