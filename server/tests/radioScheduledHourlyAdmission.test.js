import {describe,it,expect} from 'vitest';
import {scheduledHourlyAdmission as admit} from '../src/lib/radioScheduledHourlyAdmission.js';
const at=Date.parse('2026-10-24T12:00:00Z');
const base={enabled:true,slot:{id:'slot',endAt:new Date(at+180000)},nowMs:at,
 signalDurationMs:12000,fadeMs:1500,trackRemainingMs:90000};
describe('scheduled hourly signal authority',()=>{
 it('allows only a bounded approved programme window',()=>{
  expect(admit(base).allowed).toBe(true);
  expect(admit({...base,slot:{id:'slot',endAt:new Date(at+8000)}}).reason).toBe('INSUFFICIENT_SLOT_WINDOW');
  expect(admit({...base,nextSlotStartMs:at+8000}).reason).toBe('INSUFFICIENT_SLOT_WINDOW');
 });
 it('rejects LIVE, absent slot, duplicates and invalid durations',()=>{
  expect(admit({...base,live:true}).reason).toBe('LIVE_PRIORITY');
  expect(admit({...base,slot:null}).reason).toBe('NO_APPROVED_SLOT');
  expect(admit({...base,alreadyHandled:true}).reason).toBe('ALREADY_HANDLED');
  expect(admit({...base,signalDurationMs:0}).reason).toBe('INVALID_AUDIO_OR_CLOCK');
 });
 it('never inserts after the delay budget or into non-music',()=>{
  expect(admit({...base,nowMs:at+61000}).reason).toBe('HOURLY_WINDOW_EXPIRED');
  expect(admit({...base,trackCategory:'JINGLE'}).reason).toBe('NON_MUSIC_SOURCE');
  expect(admit({...base,trackRemainingMs:NaN}).reason).toBe('UNKNOWN_REMAINDER');
 });
});
