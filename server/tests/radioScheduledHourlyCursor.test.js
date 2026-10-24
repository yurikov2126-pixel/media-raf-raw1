import {describe,it,expect} from 'vitest';
import {reserveScheduledHourlySuccessor,resolveScheduledHourlySuccessor} from '../src/lib/radioScheduledHourlyCursor.js';

const now=Date.parse('2026-10-24T12:00:00Z');
const slot={id:'slot1',playlistId:'playlist1',endAt:new Date(now+180000).toISOString()};
const items=[{asset:{id:'first'}},{asset:{id:'second'}},{asset:{id:'third'}}];
describe('scheduled hourly successor reservation',()=>{
 it('advances to the next song from zero without moving the schedule boundary',()=>{
  const r=reserveScheduledHourlySuccessor({slot,items,interruptedIndex:0,nowMs:now,announcementMs:12000});
  expect(r.ok).toBe(true);
  expect(resolveScheduledHourlySuccessor(r,{slot,items,nowMs:now+12000}))
   .toMatchObject({ok:true,index:1,seekMs:0,untilMs:now+180000});
 });
 it('never resumes across a slot replacement, playlist edit, LIVE or expiration',()=>{
  const r=reserveScheduledHourlySuccessor({slot,items,interruptedIndex:0,nowMs:now,announcementMs:12000});
  expect(resolveScheduledHourlySuccessor(r,{slot,items,nowMs:now+11999}).ok).toBe(false);
  expect(resolveScheduledHourlySuccessor(r,{slot,items,nowMs:now+12000,live:true}).reason).toBe('LIVE_PRIORITY');
  expect(resolveScheduledHourlySuccessor(r,{slot:{...slot,id:'other'},items,nowMs:now+12000}).reason).toBe('SLOT_CHANGED');
  expect(resolveScheduledHourlySuccessor(r,{slot,items:[items[0],{asset:{id:'changed'}},items[2]],nowMs:now+12000}).reason).toBe('PLAYLIST_CHANGED');
  expect(resolveScheduledHourlySuccessor(r,{slot,items,nowMs:now+180000}).reason).toBe('OUTSIDE_SLOT');
 });
 it('rejects final track and insufficient space',()=>{
  expect(reserveScheduledHourlySuccessor({slot,items,interruptedIndex:2,nowMs:now,announcementMs:12000}).reason).toBe('NO_SUCCESSOR');
  expect(reserveScheduledHourlySuccessor({slot,items,interruptedIndex:0,nowMs:now+175000,announcementMs:10000}).reason).toBe('INSUFFICIENT_WINDOW');
 });
});
