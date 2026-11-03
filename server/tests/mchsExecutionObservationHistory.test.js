import test from 'node:test';
import assert from 'node:assert/strict';
import {appendMchsExecutionObservation,readMchsExecutionObservationHistory,EXECUTION_HISTORY_LIMIT}
  from '../src/lib/mchsExecutionObservationHistory.js';

const obs=(id,phase='COMPLETE')=>({
 version:1,eventId:id,eventType:'MISSILE_DANGER',phase,
 expectedRepeats:4,completedRepeats:phase==='COMPLETE'?4:2,
 naturalCompletion:phase==='COMPLETE',centralReturnConfirmed:phase==='COMPLETE',
 processRunning:false,failureReason:phase==='COMPLETE'?null:'SERVER_STOP'
});

test('event history keeps separate events, newest first in admin and no PA claims',()=>{
 let history=appendMchsExecutionObservation([],obs('danger-1'),'2026-11-03T10:00:00Z');
 history=appendMchsExecutionObservation(history,obs('clear-1','FAILED'),'2026-11-03T10:01:00Z');
 const read=readMchsExecutionObservationHistory(JSON.stringify(history)).reverse();
 assert.deepEqual(read.map(item=>item.eventId),['clear-1','danger-1']);
 assert.equal(read[0].physicalPaOutputVerified,false);
 assert.equal(read[0].publicPlaybackAuthorized,false);
 assert.equal(read[1].localProcessObservationOnly,true);
});

test('newer state of the same event does not create a duplicate entry',()=>{
 let history=appendMchsExecutionObservation([],obs('event-1','FAILED'),'2026-11-03T10:00:00Z');
 history=appendMchsExecutionObservation(history,obs('event-1'),'2026-11-03T10:01:00Z');
 assert.equal(history.length,1);
 assert.equal(history[0].phase,'COMPLETE');
});

test('history is bounded and malformed storage fails read-only',()=>{
 let history=[];
 for(let i=0;i<EXECUTION_HISTORY_LIMIT+10;i++)
  history=appendMchsExecutionObservation(history,obs('event-'+i),'2026-11-03T10:00:00Z');
 assert.equal(history.length,EXECUTION_HISTORY_LIMIT);
 assert.equal(history[0].eventId,'event-10');
 assert.deepEqual(readMchsExecutionObservationHistory('{broken'),[]);
 assert.deepEqual(readMchsExecutionObservationHistory('null'),[]);
 assert.deepEqual(readMchsExecutionObservationHistory('{}'),[]);
});

test('reader rejects invalid or nonterminal records and cannot trust PA fields',()=>{
 const history=[{...obs('real-1'),receivedAt:'2026-11-03T10:00:00Z',
                 physicalPaOutputVerified:true,publicPlaybackAuthorized:true},
  {...obs('in-progress','PLAYING'),receivedAt:'2026-11-03T10:01:00Z'},
  {...obs('broken'),eventType:'INVALID',receivedAt:'2026-11-03T10:02:00Z'}];
 const read=readMchsExecutionObservationHistory(JSON.stringify(history));
 assert.equal(read.length,1);
 assert.equal(read[0].physicalPaOutputVerified,false);
 assert.equal(read[0].publicPlaybackAuthorized,false);
});

test('invalid append arguments are rejected',()=>{
 assert.throws(()=>appendMchsExecutionObservation([],null,'now'),TypeError);
 assert.throws(()=>appendMchsExecutionObservation([],{eventId:'x'},null),TypeError);
});
