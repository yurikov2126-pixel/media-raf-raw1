import test from 'node:test';
import assert from 'node:assert/strict';
import {registerStationDispatch,reconcileStationReceipts} from '../src/lib/mchsStationExecutionReceipts.js';
const start=registerStationDispatch(null,[{eventId:'evt1',eventType:'MISSILE_DANGER',ok:true}]);
const snapshot=(phase,extras={})=>({ok:true,data:{phase,session:{eventId:'evt1',repeats:3,
 completedRepeats:0,preemptAcknowledged:false,naturalCompletion:false,
 programRestored:false,...extras}}});
test('HTTP START alone is not PCM playback',()=>{
 assert.equal(start.items[0].state,'START_ACCEPTED');
 assert.equal(start.items[0].naturalCompletion,false);
 assert.equal(start.items[0].finishedAt,null);
});
test('confirmed PCM and natural completion require all evidence',()=>{
 const playing=reconcileStationReceipts(start,snapshot('PLAYING',{preemptAcknowledged:true}));
 assert.equal(playing.ledger.items[0].state,'PLAYING');
 const resuming=reconcileStationReceipts(playing.ledger,snapshot('RESUMING',{
  preemptAcknowledged:true,naturalCompletion:true,completedRepeats:3}));
 assert.equal(resuming.ledger.items[0].naturalCompletion,true);
 assert.equal(resuming.ledger.items[0].state,'RESUMING');
 const done=reconcileStationReceipts(resuming.ledger,snapshot('COMPLETE',{
  preemptAcknowledged:true,naturalCompletion:true,completedRepeats:3,programRestored:true}));
 assert.equal(done.ledger.items[0].state,'COMPLETE');
 assert.ok(done.ledger.items[0].finishedAt);
});
test('verified idle air after ALARM is successful but not program restored',()=>{
 const done=reconcileStationReceipts(start,snapshot('COMPLETE',{
  preemptAcknowledged:true,naturalCompletion:true,completedRepeats:3,
  programRestored:false,idleAfterAlert:true}));
 assert.equal(done.ledger.items[0].state,'COMPLETE');
 assert.equal(done.ledger.items[0].programRestored,false);
 assert.equal(done.ledger.items[0].idleAfterAlert,true);
 assert.ok(done.ledger.items[0].finishedAt);
});
test('completion without program recovery cannot be marked successful',()=>{
 const result=reconcileStationReceipts(start,snapshot('COMPLETE',{
  preemptAcknowledged:true,naturalCompletion:true,completedRepeats:3}));
 assert.equal(result.ledger.items[0].state,'INCOMPLETE_EVIDENCE');
});
test('unmatched event, unavailable Worker and unrelated sessions do not change receipt',()=>{
 const unavailable=reconcileStationReceipts(start,{ok:false,reason:'TIMEOUT'});
 assert.deepEqual(unavailable.ledger,start);
 const other=reconcileStationReceipts(start,{ok:true,data:{phase:'PLAYING',session:{eventId:'evt2'}}});
 assert.equal(other.changed,false);
});
test('failed PCM is terminal, not completed',()=>{
 const failure=reconcileStationReceipts(start,snapshot('FAILED',{failure:'PCM_SOURCE_READ_FAILED'}));
 assert.equal(failure.ledger.items[0].state,'FAILED');
 assert.equal(failure.ledger.items[0].reason,'PCM_SOURCE_READ_FAILED');
});
test('all clear and duplicates keep a single receipt',()=>{
 const a=registerStationDispatch(null,[{eventId:'clear_1',eventType:'MISSILE_ALL_CLEAR',ok:true}]);
 const b=registerStationDispatch(a,[{eventId:'clear_1',eventType:'MISSILE_ALL_CLEAR',ok:true}]);
 assert.equal(b.items.length,1);
});
