import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMchsTrialStartReadiness as summarize}
 from '../src/lib/mchsAgentTrialReadiness.js';

const t=Date.parse('2026-11-04T12:00:00Z');
const event={id:'evt_1',source:'MCHS_ANDROID',verified:true,
 occurredAt:new Date(t-1000).toISOString()};
test('default is fail-closed and never queues or authorizes audio',()=>{
 const result=summarize({nowMs:t});
 assert.equal(result.ready,false);
 assert.equal(result.startQueued,false);
 assert.equal(result.automaticPlaybackEnabled,false);
 assert.equal(result.publicStreamAllowed,false);
 assert.equal(result.amplifierAllowed,false);
 assert.ok(result.reasons.includes('DEVICE_NOT_BOUND'));
 assert.ok(result.reasons.includes('DISPATCH_HALTED'));
});

test('even all reported server gates clear cannot remotely confirm local PA isolation',()=>{
 const result=summarize({deviceBound:true,trialEnabled:true,dispatchHalted:false,
  deviceLedgerHalted:false,event,nowMs:t});
 assert.deepEqual(result.reasons,[
  'LOCAL_OUTPUT_ISOLATION_NOT_ATTESTED','LOCAL_WAV_DIGEST_NOT_BOUND'
 ]);
 assert.equal(result.ready,false);
});

test('stale, forged and future events never appear eligible',()=>{
 for(const bad of [
  null,
  {...event,verified:false},
  {...event,source:'MANUAL'},
  {...event,occurredAt:new Date(t+1000).toISOString()},
  {...event,occurredAt:new Date(t-130000).toISOString()}
 ]){
  const result=summarize({deviceBound:true,trialEnabled:true,event:bad,nowMs:t});
  assert.equal(result.ready,false);
  assert.ok(result.reasons.some(reason=>reason.startsWith('ANDROID_EVENT_')||
   reason==='VERIFIED_ANDROID_EVENT_MISSING'));
 }
});

test('pending command reports conflict without changing command state',()=>{
 const state={pendingAction:'STOP',deviceBound:true,trialEnabled:true,
  event,nowMs:t};
 const before=JSON.stringify(state);
 const result=summarize(state);
 assert.ok(result.reasons.includes('COMMAND_PENDING'));
 assert.equal(JSON.stringify(state),before);
 assert.equal(result.startQueued,false);
});
