import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMchsEventExecutionObservation as parse} from '../src/lib/mchsEventExecutionObservation.js';

const completed={version:1,eventId:'event-2026-1',eventType:'MISSILE_DANGER',
 phase:'COMPLETE',expectedRepeats:4,completedRepeats:4,
 naturalCompletion:true,centralReturnConfirmed:true,
 processRunning:false,failureReason:null};

test('complete event is local-only evidence, never PA delivery',()=>{
 const result=parse(completed);
 assert.equal(result.accepted,true);
 assert.equal(result.value.physicalPaOutputVerified,false);
 assert.equal(result.value.publicPlaybackAuthorized,false);
 assert.equal(result.value.localProcessObservationOnly,true);
});
test('all clear must be exactly one repeat',()=>{
 assert.equal(parse({...completed,eventType:'MISSILE_ALL_CLEAR',
  expectedRepeats:4}).accepted,false);
 assert.equal(parse({...completed,eventType:'MISSILE_ALL_CLEAR',
  expectedRepeats:1,completedRepeats:1}).accepted,true);
});
test('contradictory process, return and repetitions rejected',()=>{
 for(const change of [
  {processRunning:true},{naturalCompletion:false},{centralReturnConfirmed:false},
  {completedRepeats:3},{failureReason:'SERVER_STOP'},
  {expectedRepeats:0},{expectedRepeats:6},{eventId:'../../escape'},
  {eventType:'UNKNOWN'}, {phase:'UNKNOWN'}]){
  assert.equal(parse({...completed,...change}).accepted,false,JSON.stringify(change));
 }
});
test('failed observed event does not imply successful playback',()=>{
 const report=parse({...completed,phase:'FAILED',naturalCompletion:false,
  completedRepeats:2,centralReturnConfirmed:false,
  processRunning:false,failureReason:'SERVER_STOP'});
 assert.equal(report.accepted,true);
 assert.equal(report.value.physicalPaOutputVerified,false);
 assert.equal(parse({...completed,phase:'FAILED',failureReason:null}).accepted,false);
});
test('incomplete and early states validated',()=>{
 assert.equal(parse({...completed,phase:'PLAYING',naturalCompletion:false,
  completedRepeats:0,centralReturnConfirmed:false,processRunning:true}).accepted,true);
 assert.equal(parse({...completed,phase:'STARTED',naturalCompletion:false,
  completedRepeats:1,centralReturnConfirmed:false,processRunning:true}).accepted,false);
});
