import test from 'node:test';
import assert from 'node:assert/strict';
import {assessIntentClaim,assessIntentAcknowledgement} from '../src/lib/mchsIntentLease.js';
const now=Date.parse('2026-11-01T12:00:00Z');
const intent={status:'STAGED',eventType:'MISSILE_DANGER',createdAt:new Date(now-10000).toISOString(),leaseUntil:null};
test('valid fresh missile command may be leased only at decision level',()=>{
 assert.equal(assessIntentClaim(intent,{nowMs:now}).allowed,true);
 assert.equal(assessIntentClaim({...intent,eventType:'UAV_DANGER'},{nowMs:now}).reason,'TYPE_NOT_ALLOWED');
});
test('stale and already leased commands blocked',()=>{
 assert.equal(assessIntentClaim({...intent,createdAt:new Date(now-121000).toISOString()},{nowMs:now}).reason,'STALE_INTENT');
 assert.equal(assessIntentClaim({...intent,leaseUntil:new Date(now+10000).toISOString()},{nowMs:now}).reason,'LEASE_ACTIVE');
});
test('acknowledgement requires current lease token',()=>{
 const leased={...intent,status:'LEASED',leaseToken:'abc',leaseUntil:new Date(now+10000).toISOString()};
 assert.equal(assessIntentAcknowledgement(leased,'abc',{nowMs:now}).allowed,true);
 assert.equal(assessIntentAcknowledgement(leased,'wrong',{nowMs:now}).reason,'LEASE_TOKEN_MISMATCH');
 assert.equal(assessIntentAcknowledgement(leased,'abc',{nowMs:now+20000}).reason,'LEASE_EXPIRED');
});
