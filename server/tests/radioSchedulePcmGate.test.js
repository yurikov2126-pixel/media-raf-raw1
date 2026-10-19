import test from 'node:test';
import assert from 'node:assert/strict';
import {boundScheduledPcm,postScheduleGuardActive} from '../src/lib/radioSchedulePcmGate.js';
test('all decoded PCM passes before schedule boundary',()=>{
 const bytes=Buffer.alloc(19200,127);
 const result=boundScheduledPcm(bytes,2000,1800);
 assert.equal(result.pcm.length,bytes.length);
 assert.equal(result.truncated,false);
});
test('oversize PCM chunk is truncated on stereo frame boundary',()=>{
 const bytes=Buffer.alloc(19200,127);
 const result=boundScheduledPcm(bytes,2000,1950);
 assert.equal(result.pcm.length,9600);
 assert.equal(result.truncated,true);
});
test('no scheduled audio reaches encoder at or after endAt',()=>{
 const bytes=Buffer.alloc(19200);
 for(const now of [2000,2001,2200]){
   const result=boundScheduledPcm(bytes,2000,now);
   assert.equal(result.pcm.length,0);
   assert.equal(result.truncated,true);
 }
});
test('silent handoff remains strictly bounded',()=>{
 const end='2026-10-19T10:00:00.000Z';
 const at=t=>Date.parse('2026-10-19T10:00:'+t+'Z');
 assert.equal(postScheduleGuardActive(end,at('00')),true);
 assert.equal(postScheduleGuardActive(end,at('44')),true);
 assert.equal(postScheduleGuardActive(end,at('45')),false);
});
