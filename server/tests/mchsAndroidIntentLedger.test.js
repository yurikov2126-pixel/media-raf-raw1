import test from 'node:test';
import assert from 'node:assert/strict';
import {stageAndroidExecutionIntents} from '../src/lib/mchsAndroidIntentLedger.js';
const danger={sourceEventId:'android-a',eventId:'e1',eventType:'MISSILE_DANGER',result:'OBSERVED'};
const clear={sourceEventId:'android-b',eventId:'e2',eventType:'MISSILE_ALL_CLEAR',result:'OBSERVED'};
test('Android danger and all-clear become durable non-executable intents',()=>{
 const first=stageAndroidExecutionIntents(null,[danger,clear],{dangerRepeats:3});
 assert.equal(first.added.length,2);
 assert.deepEqual(first.added.map(x=>x.repetitions),[3,1]);
 assert.equal(first.added[0].status,'STAGED');
 assert.equal(first.added[0].dispatchAuthorized,false);
 assert.equal(first.automaticPlaybackEnabled,false);
 const replay=stageAndroidExecutionIntents(first.ledger,[danger,clear],{dangerRepeats:5});
 assert.equal(replay.added.length,0);
 assert.deepEqual(replay.ledger.items.map(x=>x.repetitions),[3,1]);
});
test('rejected notifications never enter the ledger',()=>{
 const result=stageAndroidExecutionIntents(null,[{...danger,result:'REJECTED'}]);
 assert.equal(result.ledger.items.length,0);
});
