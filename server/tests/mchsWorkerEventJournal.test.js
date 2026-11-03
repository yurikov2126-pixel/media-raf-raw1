import test from 'node:test';
import assert from 'node:assert/strict';
import {createMchsWorkerEventJournal} from '../src/lib/mchsWorkerEventJournal.js';
const event={eventId:'test-1',eventType:'MISSILE_DANGER',assetId:'alarm-a',repeats:3,revision:11,trialOnly:true};
const instant='2026-11-03T10:00:00.000Z';
const make=()=>createMchsWorkerEventJournal({now:()=>instant});
test('only full PCM completion records event-bound proof',()=>{
 const journal=make();
 const start=journal.begin(event);
 assert.equal(start.ok,true);
 assert.equal(journal.last(),null);
 assert.equal(journal.observe({active:true,revision:11,repeats:3,completedRepeats:2}).completedRepeats,2);
 assert.equal(journal.last(),null);
 const done=journal.observe({active:false,revision:12,repeats:3,completedRepeats:3,lastStopReason:'FILE_COMPLETED'});
 assert.equal(done.naturalCompletion,true);
 assert.equal(done.eventId,event.eventId);
 assert.equal(done.startRevision,11);
 assert.equal(done.completedAt,instant);
 assert.equal(journal.current(),null);
 assert.equal(journal.get('test-1').naturalCompletion,true);
});
test('early stop never reports natural completion',()=>{
 const journal=make();journal.begin(event);
 const stopped=journal.observe({active:false,revision:12,repeats:3,
  completedRepeats:1,lastStopReason:'OPERATOR_STOP'});
 assert.equal(stopped.naturalCompletion,false);
 assert.equal(journal.last().completedRepeats,1);
});
test('wrong final revision and short repeats cannot become successful',()=>{
 for(const bad of [
  {revision:13,repeats:3,completedRepeats:3,lastStopReason:'FILE_COMPLETED'},
  {revision:12,repeats:3,completedRepeats:2,lastStopReason:'FILE_COMPLETED'},
  {revision:12,repeats:2,completedRepeats:3,lastStopReason:'FILE_COMPLETED'}
 ]){
  const journal=make();journal.begin(event);
  const x=journal.observe({active:false,...bad});
  assert.equal(x.naturalCompletion,false);
 }
});
test('unbound, wrong type, or invalid all-clear repeats cannot be attributed',()=>{
 const journal=make();
 for(const patch of [{trialOnly:false},{eventId:'../danger'},
   {eventType:'UNCLASSIFIED'},{eventType:'MISSILE_ALL_CLEAR',repeats:2}]){
  assert.equal(journal.begin({...event,...patch}).ok,false);
 }
 assert.equal(journal.current(),null);
});
test('same event cannot be replayed after completion',()=>{
 const journal=make();journal.begin(event);
 journal.observe({active:false,revision:12,repeats:3,completedRepeats:3,lastStopReason:'FILE_COMPLETED'});
 assert.equal(journal.begin(event).reason,'DUPLICATE_TRIAL_EVENT');
});
test('aborted trial is remembered but not success',()=>{
 const journal=make();journal.begin(event);
 const x=journal.abort('WORKER_DISCONNECTED');
 assert.equal(x.naturalCompletion,false);
 assert.equal(journal.current(),null);
 assert.equal(journal.begin(event).reason,'DUPLICATE_TRIAL_EVENT');
});
test('bounded FIFO history and event isolation',()=>{
 const journal=createMchsWorkerEventJournal({capacity:2,now:()=>instant});
 for(let i=1;i<=3;i++){
  journal.begin({...event,eventId:'id-'+i,revision:20+i});
  journal.observe({active:false,revision:21+i,repeats:3,completedRepeats:3,lastStopReason:'FILE_COMPLETED'});
 }
 assert.equal(journal.get('id-1'),null);
 assert.deepEqual(journal.recent().map(x=>x.eventId),['id-2','id-3']);
});
test('active session rejects another start and malformed progress',()=>{
 const journal=make();journal.begin(event);
 assert.equal(journal.begin({...event,eventId:'other'}).reason,'SESSION_ACTIVE');
 assert.equal(journal.observe({active:true,revision:30,repeats:3,completedRepeats:2}),null);
 assert.equal(journal.observe({active:true,revision:11,repeats:3,completedRepeats:3}).completedRepeats,3);
 assert.equal(journal.observe({active:true,revision:11,repeats:3,completedRepeats:2}),null);
 assert.equal(journal.current().completedRepeats,3);
});
