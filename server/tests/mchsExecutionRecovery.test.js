import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcilePersistedAlarmAfterRestart,recordAndroidEventId} from '../src/lib/mchsExecutionRecovery.js';
test('restart changes unfinished execution into interrupted hold without playback',()=>{
 for(const state of ['DANGER_ACTIVE','DANGER_PENDING','CLEAR_PENDING']){
  const outcome=reconcilePersistedAlarmAfterRestart({state});
  assert.equal(outcome.journal.state,'INTERRUPTED');
  assert.equal(outcome.changed,true);
  assert.equal(outcome.automaticPlaybackEnabled,false);
 }
});
test('recovery is idempotent',()=>{
 const first=reconcilePersistedAlarmAfterRestart({state:'DANGER_ACTIVE'});
 const second=reconcilePersistedAlarmAfterRestart(first.journal);
 assert.equal(second.changed,false);
 assert.equal(second.journal.entries.length,1);
});
test('Android event IDs persist boundedly and reject duplicate delivery',()=>{
 const a=recordAndroidEventId([],'mchs-1');
 assert.equal(a.accepted,true);
 assert.equal(recordAndroidEventId(a.seen,'mchs-1').reason,'DUPLICATE_EVENT');
 let seen=[];for(let i=0;i<510;i++)seen=recordAndroidEventId(seen,'id-'+i).seen;
 assert.equal(seen.length,500);assert.equal(seen.at(-1),'id-509');
});
