import test from 'node:test';import assert from 'node:assert/strict';
import {advanceMchsReceiptLedger} from '../src/lib/mchsReceiptLedger.js';
const now=Date.parse('2026-11-02T12:00:00Z');
const x={eventId:'event1',eventType:'MISSILE_DANGER',channel:'WORKER',observedAt:'2026-11-02T11:59:59Z',nowMs:now};
test('one receipt per event per channel',()=>{const first=advanceMchsReceiptLedger(null,x);assert.equal(first.accepted,true);assert.equal(advanceMchsReceiptLedger(first,x).reason,'DUPLICATE_RECEIPT');assert.equal(advanceMchsReceiptLedger(first,{...x,channel:'AGENT'}).accepted,true);});
test('halt, stale and unsupported type are never accepted',()=>{assert.equal(advanceMchsReceiptLedger(null,{...x,halted:true}).reason,'HALTED');assert.equal(advanceMchsReceiptLedger(null,{...x,observedAt:'2026-11-02T11:55:00Z'}).reason,'STALE_RECEIPT');assert.equal(advanceMchsReceiptLedger(null,{...x,eventType:'OTHER'}).reason,'TYPE_NOT_ALLOWED');});
