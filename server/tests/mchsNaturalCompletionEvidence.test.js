import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsNaturalCompletion as assess} from '../src/lib/mchsNaturalCompletionEvidence.js';
const now=Date.parse('2026-11-03T10:00:00Z');
const intent={eventId:'event-danger',eventType:'MISSILE_DANGER',assetId:'asset-a',repetitions:3};
const worker={eventId:intent.eventId,eventType:intent.eventType,assetId:intent.assetId,
 active:false,lastStopReason:'FILE_COMPLETED',completedRepeats:3,repeats:3,
 startRevision:41,revision:42,completedAt:new Date(now-1000).toISOString()};
const agent={version:2,eventId:intent.eventId,state:'COMPLETED',completedRepeats:3,
 expectedRepeats:3,localNaturalCompletionObserved:true,processRunning:false,
 failureReason:null,reportedAt:new Date(now-500).toISOString()};
const check=(patch={})=>assess({intent,worker,agent,nowMs:now,...patch});
test('correlates matching natural completion from both event-bound channels without dispatch',()=>{
 const x=check();
 assert.equal(x.bothNaturallyCompleted,true);
 assert.equal(x.workerComplete,true);
 assert.equal(x.agentComplete,true);
 assert.equal(x.publicPlaybackAuthorized,false);
 assert.equal(x.physicalAudibilityVerified,false);
});
test('a shared Worker status without event binding is NOT completion evidence',()=>{
 const w={...worker};
 delete w.eventId;
 delete w.eventType;
 delete w.startRevision;
 const x=check({worker:w});
 assert.equal(x.bothNaturallyCompleted,false);
 assert.equal(x.workerComplete,false);
 assert.ok(x.holds.includes('WORKER_EVENT_NOT_BOUND'));
});
test('Agent v1 and failure do not imply natural completion',()=>{
 for(const a of [
  {...agent,version:1},{...agent,expectedRepeats:2},
  {...agent,processRunning:true},{...agent,failureReason:'RuntimeError'},
  {...agent,state:'STOPPED',localNaturalCompletionObserved:false},
  {...agent,eventId:'other'}]){
  assert.equal(check({agent:a}).bothNaturallyCompleted,false);
 }
});
test('stale completion receipts are not reusable',()=>{
 const old=new Date(now-120000).toISOString();
 const x=check({worker:{...worker,completedAt:old},agent:{...agent,reportedAt:old}});
 assert.equal(x.bothNaturallyCompleted,false);
 assert.ok(x.holds.includes('WORKER_STALE_OR_MISSING_TIME'));
 assert.ok(x.holds.includes('AGENT_STALE_OR_MISSING_TIME'));
});
test('exact one-repeat all-clear succeeds independently',()=>{
 const clearIntent={eventId:'event-clear',eventType:'MISSILE_ALL_CLEAR',
  assetId:'asset-clear',repetitions:1};
 const x=check({intent:clearIntent,worker:{...worker,eventId:'event-clear',
  eventType:'MISSILE_ALL_CLEAR',assetId:'asset-clear',completedRepeats:1,repeats:1},
  agent:{...agent,eventId:'event-clear',completedRepeats:1,expectedRepeats:1}});
 assert.equal(x.bothNaturallyCompleted,true);
 assert.equal(check({intent:{...clearIntent,repetitions:2}}).bothNaturallyCompleted,false);
});
test('changed revision, wrong asset, or incomplete repeats do not confirm',()=>{
 for(const w of [
  {...worker,revision:45},{...worker,assetId:'other'},
  {...worker,completedRepeats:2},{...worker,active:true},
  {...worker,lastStopReason:'OPERATOR_STOP'}]){
  assert.equal(check({worker:w}).bothNaturallyCompleted,false);
 }
});
test('missing inputs never authorize production broadcast',()=>{
 const x=assess({});
 assert.equal(x.bothNaturallyCompleted,false);
 assert.equal(x.automaticDispatchEnabled,false);
 assert.equal(x.publicPlaybackAuthorized,false);
});
