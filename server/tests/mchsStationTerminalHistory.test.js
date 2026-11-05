import test from 'node:test';
import assert from 'node:assert/strict';
import {createMchsStationPcmExecutor} from '../src/lib/mchsStationPcmExecutor.js';
import {registerStationDispatch,reconcileStationReceiptHistory} from '../src/lib/mchsStationExecutionReceipts.js';

const source=(bytes=Buffer.from([1,0,1,0]))=>({
 size:bytes.length,read:(offset,len)=>bytes.subarray(offset,offset+len),close:()=>{}
});
const start=(id,repeats=1)=>({eventId:id,eventType:'MISSILE_DANGER',assetId:'alarm1',
 repeats,pcm:source()});
test('Worker retains multiple terminal PCM sessions even after next START',()=>{
 const worker=createMchsStationPcmExecutor();
 assert.equal(worker.prepare(start('event1')).ok,true);
 worker.replace(Buffer.alloc(4));
 worker.observeProgram(Buffer.from([2,0,2,0]));
 assert.equal(worker.snapshot().phase,'COMPLETE');
 assert.equal(worker.prepare(start('event2')).ok,true);
 worker.replace(Buffer.alloc(4));
 worker.observeProgram(Buffer.from([2,0,2,0]));
 assert.deepEqual(worker.terminalHistory().map(e=>e.eventId),['event1','event2']);
 const pending=registerStationDispatch(null,[
  {eventId:'event1',eventType:'MISSILE_DANGER',ok:true},
  {eventId:'event2',eventType:'MISSILE_DANGER',ok:true}]);
 const status={ok:true,data:{...worker.snapshot(),terminalHistory:worker.terminalHistory()}};
 const done=reconcileStationReceiptHistory(pending,status);
 assert.equal(done.ledger.items[0].state,'COMPLETE');
 assert.equal(done.ledger.items[1].state,'COMPLETE');
});
test('history never accepts fabricated incomplete PCM as COMPLETE',()=>{
 const initial=registerStationDispatch(null,[{eventId:'event1',eventType:'MISSILE_DANGER',ok:true}]);
 const entry={phase:'COMPLETE',eventId:'event1',repeats:1,completedRepeats:1,
  preemptAcknowledged:true,naturalCompletion:true,programRestored:false};
 const result=reconcileStationReceiptHistory(initial,{ok:true,data:{
  phase:'IDLE',session:null,terminalHistory:[entry]}});
 assert.equal(result.ledger.items[0].state,'INCOMPLETE_EVIDENCE');
});
test('unknown events and unavailable status cannot modify saved receipts',()=>{
 const initial=registerStationDispatch(null,[{eventId:'event1',eventType:'MISSILE_DANGER',ok:true}]);
 const history=[{phase:'COMPLETE',eventId:'other',repeats:1,completedRepeats:1,
  preemptAcknowledged:true,naturalCompletion:true,programRestored:true}];
 const out=reconcileStationReceiptHistory(initial,{ok:true,data:{phase:'IDLE',
  session:null,terminalHistory:history}});
 assert.equal(out.changed,false);
 assert.deepEqual(out.ledger,initial);
 const timeout=reconcileStationReceiptHistory(initial,{ok:false});
 assert.deepEqual(timeout.ledger,initial);
});
test('Worker retains FAILED terminal evidence without marking success',()=>{
 const worker=createMchsStationPcmExecutor();
 assert.equal(worker.prepare(start('bad1')).ok,true);
 worker.abort('PCM_SOURCE_READ_FAILED');
 const history=worker.terminalHistory();
 assert.equal(history[0].phase,'FAILED');
 const ledger=registerStationDispatch(null,[{eventId:'bad1',ok:true}]);
 const out=reconcileStationReceiptHistory(ledger,{ok:true,data:{
  ...worker.snapshot(),terminalHistory:history}});
 assert.equal(out.ledger.items[0].state,'FAILED');
});
