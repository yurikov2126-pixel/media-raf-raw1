import test from 'node:test';
import assert from 'node:assert/strict';
import {createAlarmPcmClock} from '../src/lib/mchsAlarmPcmClock.js';
test('monotonic alarm PCM clock paces frames without skipping sequence',async()=>{
 let time=1000;const waits=[];
 const clock=createAlarmPcmClock({now:()=>time,sleep:async ms=>{waits.push(ms);time+=ms;}});
 await clock.pace();await clock.pace();await clock.pace();
 assert.equal(clock.snapshot().frames,3);
 assert.deepEqual(waits,[20,20]);
 assert.equal(clock.snapshot().gaps,0);
});
test('records large stalls and does not drop PCM frames',async()=>{
 let time=1000;
 const clock=createAlarmPcmClock({now:()=>time,sleep:async ms=>{time+=ms;}});
 await clock.pace();time+=110;
 await clock.pace();
 assert.equal(clock.snapshot().frames,2);
 assert.equal(clock.snapshot().gaps,1);
 assert.ok(clock.snapshot().maxDelayMs>=90);
 clock.reset();assert.equal(clock.snapshot().frames,0);
});
