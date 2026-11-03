import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMchsAgentPlaybackReport as parse} from '../src/lib/mchsAgentPlaybackReport.js';
const valid={version:2,eventId:'danger-1',state:'COMPLETED',
 completedRepeats:5,expectedRepeats:5,naturalCompletion:true,
 processRunning:false,failureReason:null};
test('full five-repeat natural completion is a local process observation only',()=>{
 const x=parse(valid);
 assert.equal(x.accepted,true);
 assert.equal(x.value.localNaturalCompletionObserved,true);
 assert.equal(x.value.expectedRepeats,5);
 assert.equal(x.value.eventId,'danger-1');
});
test('all-clear exactly once has its own completion observation',()=>{
 const result=parse({...valid,eventId:'clear-2',completedRepeats:1,expectedRepeats:1});
 assert.equal(result.accepted,true);
 assert.equal(result.value.localNaturalCompletionObserved,true);
});
test('V1 Agent remains accepted but does not assert natural completion',()=>{
 const x=parse({version:1,eventId:'old-agent',state:'COMPLETED',completedRepeats:5});
 assert.equal(x.accepted,true);
 assert.equal(x.value.localNaturalCompletionObserved,false);
 assert.equal(x.value.legacyReport,true);
});
test('reject contradictory complete states, a live VLC process and missing repeats',()=>{
 for(const patch of [
  {completedRepeats:4},{state:'PLAYING'}, {processRunning:true},
  {failureReason:'RuntimeError'},{naturalCompletion:false},
  {expectedRepeats:0},{expectedRepeats:6},{completedRepeats:6},
  {eventId:'../path'},{failureReason:{name:'Error'}}
 ]){
  const x=parse({...valid,...patch});
  assert.equal(x.accepted,false,JSON.stringify(patch));
 }
});
test('failed VLC process does not assert success',()=>{
 const x=parse({...valid,state:'STOPPED',completedRepeats:2,
  naturalCompletion:false,failureReason:'RuntimeError'});
 assert.equal(x.accepted,true);
 assert.equal(x.value.localNaturalCompletionObserved,false);
 assert.equal(x.value.failureReason,'RuntimeError');
});
test('STARTING cannot have completed repeats',()=>{
 assert.equal(parse({...valid,state:'STARTING',completedRepeats:1,
  naturalCompletion:false}).accepted,false);
});
test('IDLE requires a clean empty local report',()=>{
 const idle={version:2,eventId:null,state:'IDLE',completedRepeats:0,
  expectedRepeats:0,processRunning:false,naturalCompletion:false,failureReason:null};
 assert.equal(parse(idle).accepted,true);
 for(const patch of [{eventId:'x'},{expectedRepeats:1},{processRunning:true},
  {completedRepeats:1}]){
  assert.equal(parse({...idle,...patch}).accepted,false);
 }
});
