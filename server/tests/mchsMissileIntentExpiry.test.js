import test from 'node:test';
import assert from 'node:assert/strict';
import {intentExpiryDecision,MCHS_INTENT_TTL_MS} from '../src/lib/mchsMissileIntentExpiry.js';
const now=Date.parse('2026-11-01T12:00:00Z');
test('staged intent expires after 120 seconds',()=>{
 assert.equal(intentExpiryDecision({status:'STAGED',createdAt:new Date(now-MCHS_INTENT_TTL_MS).toISOString()},now).expire,true);
 assert.equal(intentExpiryDecision({status:'STAGED',createdAt:new Date(now-30000).toISOString()},now).expire,false);
});
test('terminal intent is never reopened by expiry check',()=>{
 assert.equal(intentExpiryDecision({status:'EXPIRED',createdAt:new Date(now-999999).toISOString()},now).expire,false);
});
test('invalid and future dates fail closed',()=>{
 assert.equal(intentExpiryDecision({status:'STAGED',createdAt:'garbage'},now).reason,'UNKNOWN_CREATION_TIME');
 assert.equal(intentExpiryDecision({status:'STAGED',createdAt:new Date(now+60000).toISOString()},now).reason,'FUTURE_CREATION_TIME');
});
