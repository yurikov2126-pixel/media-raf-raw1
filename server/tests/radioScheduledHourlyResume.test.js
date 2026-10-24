import {describe,it,expect} from 'vitest';
import {reserveScheduledHourlySuccessor} from '../src/lib/radioScheduledHourlyCursor.js';
import {resolveHourlyScheduledResume} from '../src/lib/radioScheduledHourlyResume.js';
const now=Date.parse('2026-10-24T12:00:00Z');
const slot={id:'s',playlistId:'p',endAt:new Date(now+90000).toISOString()};
const items=[{asset:{id:'a',durationMs:120000}},
 {asset:{id:'b',durationMs:20000}},{asset:{id:'c',durationMs:30000}}];
const r=reserveScheduledHourlySuccessor({slot,items,interruptedIndex:0,nowMs:now,announcementMs:10000});
describe('scheduled hour resume timeline',()=>{
 it('starts next song at zero after announcement',()=>{
  expect(resolveHourlyScheduledResume(r,{slot,items,nowMs:now+10000}))
   .toMatchObject({ok:true,index:1,seekMs:0,assetId:'b'});
 });
 it('advances once to the following song rather than replaying the skipped one',()=>{
  expect(resolveHourlyScheduledResume(r,{slot,items,nowMs:now+29999}))
   .toMatchObject({ok:true,index:1,seekMs:19999});
  expect(resolveHourlyScheduledResume(r,{slot,items,nowMs:now+30000}))
   .toMatchObject({ok:true,index:2,seekMs:0,assetId:'c'});
 });
 it('keeps strict end and aborts revoked slot or LIVE',()=>{
  expect(resolveHourlyScheduledResume(r,{slot,items,nowMs:now+90000}).reason).toBe('OUTSIDE_SLOT');
  expect(resolveHourlyScheduledResume(r,{slot,items,nowMs:now+10000,live:true}).reason).toBe('LIVE_PRIORITY');
  expect(resolveHourlyScheduledResume(r,{slot:{...slot,id:'other'},items,nowMs:now+10000}).reason).toBe('SLOT_CHANGED');
 });
});
