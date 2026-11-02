import test from 'node:test';import assert from 'node:assert/strict';
import {createMchsWorkerAlarmAdapter} from '../src/lib/mchsWorkerAlarmAdapter.js';
const spec={eventId:'evt',eventType:'MISSILE_DANGER',assetId:'alarm1',repeats:3,
 publicStreamAllowed:false,amplifierAllowed:false};
test('real shared public Worker remains blocked from isolated trial',async()=>{
 let called=false;
 const adapter=createMchsWorkerAlarmAdapter({request:async()=>{called=true;throw Error('MUST_NOT_CALL')}});
 const start=await adapter.start(spec);
 assert.equal(start.confirmed,false);assert.equal(start.reason,'PUBLIC_OUTPUT_NOT_ISOLATED');
 assert.equal(called,false);
});
test('only missile types, and all-clear repeats once',async()=>{
 const adapter=createMchsWorkerAlarmAdapter({isolatedOutputVerified:true,
 request:async()=>{throw Error('MUST_NOT_CALL')}});
 assert.equal((await adapter.start({...spec,eventType:'OTHER'})).confirmed,false);
 assert.equal((await adapter.start({...spec,eventType:'MISSILE_ALL_CLEAR'})).confirmed,false);
});
test('STOP cannot claim completion when output isolation unverified',async()=>{
 const adapter=createMchsWorkerAlarmAdapter({request:async()=>{throw Error('MUST_NOT_CALL')}});
 const stopped=await adapter.stop(spec);assert.equal(stopped.confirmed,false);
});
