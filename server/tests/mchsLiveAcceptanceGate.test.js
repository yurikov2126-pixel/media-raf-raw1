import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsLiveAcceptance,MCHS_LIVE_ACCEPTANCE_REQUIREMENTS} from '../src/lib/mchsLiveAcceptanceGate.js';
const now=Date.parse('2026-11-02T10:00:00Z');
test('missing verification never permits real broadcast',()=>{
 const r=assessMchsLiveAcceptance({},now);
 assert.equal(r.missing.length,MCHS_LIVE_ACCEPTANCE_REQUIREMENTS.length);
 assert.equal(r.paOutputAuthorized,false);
 assert.equal(r.realAutomaticBroadcastEnabled,false);
});
test('self attestations and stale evidence do not count',()=>{
 const a=Object.fromEntries(MCHS_LIVE_ACCEPTANCE_REQUIREMENTS.map(x=>[x,{verified:true,independent:false,testedAt:new Date(now).toISOString()}]));
 assert.equal(assessMchsLiveAcceptance(a,now).missing.length,MCHS_LIVE_ACCEPTANCE_REQUIREMENTS.length);
 const b=Object.fromEntries(MCHS_LIVE_ACCEPTANCE_REQUIREMENTS.map(x=>[x,{verified:true,independent:true,testedAt:new Date(now-90000000).toISOString()}]));
 assert.equal(assessMchsLiveAcceptance(b,now).phase,'ACCEPTANCE_INCOMPLETE');
});
test('even all evidence requires separate physical authorization',()=>{
 const a=Object.fromEntries(MCHS_LIVE_ACCEPTANCE_REQUIREMENTS.map(x=>[x,{verified:true,independent:true,testedAt:new Date(now).toISOString()}]));
 const r=assessMchsLiveAcceptance(a,now);
 assert.equal(r.phase,'REQUIRES_SEPARATE_PHYSICAL_AUTHORIZATION');
 assert.equal(r.realAutomaticBroadcastEnabled,false);
 assert.equal(r.operatorHold,true);
});
