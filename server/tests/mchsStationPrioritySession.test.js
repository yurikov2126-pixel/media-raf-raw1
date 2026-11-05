import test from 'node:test';
import assert from 'node:assert/strict';
import {createMchsStationPrioritySession} from '../src/lib/mchsStationPrioritySession.js';

const danger={eventId:'danger_001',eventType:'MISSILE_DANGER',assetId:'asset_a',repeats:2};
const clear={eventId:'clear_001',eventType:'MISSILE_ALL_CLEAR',assetId:'asset_b',repeats:1};
const full=(manager,event)=> {
 assert.equal(manager.enter(event).accepted,true);
 assert.equal(manager.preempted({eventId:event.eventId,sourceSuspended:true}).accepted,true);
 assert.equal(manager.frameCompleted({eventId:event.eventId,repeats:event.repeats,reason:'FILE_COMPLETED'}).accepted,true);
 assert.equal(manager.restored({eventId:event.eventId,programAudioConfirmed:true}).accepted,true);
};

test('real station priority lifecycle preempt -> PCM natural finish -> normal program resumed',()=>{
 const manager=createMchsStationPrioritySession();
 assert.equal(manager.enter(danger).phase,'PREEMPTING');
 assert.equal(manager.snapshot().session.preemptAcknowledged,false);
 assert.equal(manager.preempted({eventId:danger.eventId,sourceSuspended:true}).phase,'PLAYING');
 assert.equal(manager.frameCompleted({eventId:danger.eventId,repeats:2,reason:'FILE_COMPLETED'}).phase,'RESUMING');
 assert.equal(manager.restored({eventId:danger.eventId,programAudioConfirmed:true}).phase,'COMPLETE');
 assert.equal(manager.snapshot().session.programRestored,true);
 assert.equal(manager.snapshot().session.naturalCompletion,true);
 assert.equal(manager.snapshot().last.phase,'COMPLETE');
});

test('all clear can follow danger, but only with new event binding',()=>{
 const manager=createMchsStationPrioritySession();
 full(manager,danger);
 assert.equal(manager.enter({...danger}).reason,'REPLAYED_EVENT');
 full(manager,clear);
 assert.equal(manager.history().length,2);
});

test('an event cannot overwrite a session while Worker is preempting, playing or resuming',()=>{
 const manager=createMchsStationPrioritySession();
 manager.enter(danger);
 assert.equal(manager.enter(clear).reason,'PRIORITY_SESSION_ACTIVE');
 manager.preempted({eventId:danger.eventId,sourceSuspended:true});
 assert.equal(manager.enter(clear).reason,'PRIORITY_SESSION_ACTIVE');
 manager.frameCompleted({eventId:danger.eventId,repeats:2,reason:'FILE_COMPLETED'});
 assert.equal(manager.enter(clear).reason,'PRIORITY_SESSION_ACTIVE');
});

test('a START receipt without suspended normal source is not considered a preempt',()=>{
 const manager=createMchsStationPrioritySession();
 manager.enter(danger);
 assert.equal(manager.preempted({eventId:danger.eventId,sourceSuspended:false}).phase,'FAILED');
 assert.equal(manager.snapshot().last.naturalCompletion,false);
});

test('wrong event, count or partial PCM completion never yields COMPLETE',()=>{
 const manager=createMchsStationPrioritySession();
 manager.enter(danger);
 assert.equal(manager.frameCompleted({eventId:danger.eventId,repeats:2,reason:'FILE_COMPLETED'}).accepted,false);
 assert.equal(manager.preempted({eventId:'stranger',sourceSuspended:true}).accepted,false);
 manager.preempted({eventId:danger.eventId,sourceSuspended:true});
 assert.equal(manager.frameCompleted({eventId:danger.eventId,repeats:1,reason:'FILE_COMPLETED'}).phase,'FAILED');
 assert.equal(manager.snapshot().last.programRestored,false);
});

test('resuming is not the same as normal program actually audible',()=>{
 const manager=createMchsStationPrioritySession();
 manager.enter(danger);
 manager.preempted({eventId:danger.eventId,sourceSuspended:true});
 manager.frameCompleted({eventId:danger.eventId,repeats:2,reason:'FILE_COMPLETED'});
 assert.equal(manager.snapshot().phase,'RESUMING');
 assert.equal(manager.restored({eventId:danger.eventId,programAudioConfirmed:false}).phase,'FAILED');
});

test('no stage emits production radio output or GPIO commands',()=>{
 const manager=createMchsStationPrioritySession();
 full(manager,danger);
 for(const key of ['readyForLiveDispatch','liveDispatchAuthorized','publicRadioEnabled','amplifierEnabled'])
  assert.equal(manager.snapshot()[key],false);
});

test('invalid, duplicate and unknown event bindings rejected',()=>{
 for(const event of [
  {...danger,eventId:'!'},
  {...danger,repeats:0},
  {...danger,repeats:6},
  {...danger,eventType:'UNKNOWN'},
  {...clear,repeats:2},
  {...danger,assetId:''}
 ]){
  const manager=createMchsStationPrioritySession();
  assert.equal(manager.enter(event).reason,'INVALID_EVENT_BINDING');
 }
 const manager=createMchsStationPrioritySession();
 manager.enter(danger);
 manager.abort('CONNECTION_DROPPED');
 assert.equal(manager.enter(danger).reason,'REPLAYED_EVENT');
});

test('bounded history does not permit replay of evicted events',()=>{
 const manager=createMchsStationPrioritySession({historyLimit:1});
 full(manager,danger);
 full(manager,clear);
 assert.equal(manager.history().length,1);
 assert.equal(manager.enter(danger).reason,'REPLAYED_EVENT');
});
