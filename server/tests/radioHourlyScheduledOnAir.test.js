import {describe,it,expect} from 'vitest';
import {scheduledHourlyAdmission} from '../src/lib/radioScheduledHourlyAdmission.js';
import {reserveScheduledHourlySuccessor,resolveScheduledHourlySuccessor} from '../src/lib/radioScheduledHourlyCursor.js';
import {resolveHourlyScheduledResume} from '../src/lib/radioScheduledHourlyResume.js';

const t=Date.parse('2026-10-25T09:00:00Z');
const slot={id:'slot-a',playlistId:'playlist-a',endAt:new Date(t+240000).toISOString()};
const items=[
 {asset:{id:'song-a',durationMs:150000}},
 {asset:{id:'song-b',durationMs:90000}},
 {asset:{id:'song-c',durationMs:80000}}
];

describe('scheduled hourly live transition gate',()=>{
 it('allows repeating the same hour asset in successive hours with independent reservations',()=>{
  const one=reserveScheduledHourlySuccessor({slot,items,interruptedIndex:0,nowMs:t,announcementMs:8800});
  expect(one).toMatchObject({ok:true,targetAssetId:'song-b',targetIndex:1});
  expect(resolveScheduledHourlySuccessor(one,{slot,items,nowMs:t+8800}))
   .toMatchObject({ok:true,index:1,seekMs:0});
  const later={...slot,id:'slot-next',endAt:new Date(t+3600000+240000).toISOString()};
  const next=reserveScheduledHourlySuccessor({slot:later,items,interruptedIndex:0,nowMs:t+3600000,announcementMs:8800});
  expect(next.ok).toBe(true);
  expect(next.slotId).not.toBe(one.slotId);
 });
 it('does not admit the signal across a next-slot start even if current slot is longer',()=>{
  const params={enabled:true,slot,nowMs:t,signalDurationMs:8800,fadeMs:1500,
    trackRemainingMs:130000,trackCategory:'MUSIC'};
  expect(scheduledHourlyAdmission({...params,nextSlotStartMs:t+5000}).reason).toBe('INSUFFICIENT_SLOT_WINDOW');
  expect(scheduledHourlyAdmission({...params,nextSlotStartMs:t+20000}).allowed).toBe(true);
  expect(scheduledHourlyAdmission({...params,live:true}).reason).toBe('LIVE_PRIORITY');
 });
 it('rejects resumed music after programme replacement or playlist edits',()=>{
  const r=reserveScheduledHourlySuccessor({slot,items,interruptedIndex:0,nowMs:t,announcementMs:8800});
  expect(resolveHourlyScheduledResume(r,{slot,items,nowMs:t+8800}))
   .toMatchObject({ok:true,index:1,seekMs:0});
  expect(resolveHourlyScheduledResume(r,{slot:{...slot,id:'other'},items,nowMs:t+8800}).ok).toBe(false);
  const changed=[items[0],{asset:{id:'replaced',durationMs:90000}},items[2]];
  expect(resolveHourlyScheduledResume(r,{slot,items:changed,nowMs:t+8800}).reason).toBe('PLAYLIST_CHANGED');
 });
});
