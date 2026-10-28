import { describe, it, expect } from 'vitest';
import { inspectMchsRadioAuthority as inspect } from '../src/lib/mchsRadioAuthorityInspection.js';
const src=(mode,id)=>({mode,id,trackId:id});
describe('MCHS radio authority integration contract',()=>{
 it('does not dispatch or change live authority',()=>{
  const r=inspect({current:src('LIVE','host'),scheduleKnown:true,scheduleActive:false,publicLive:true});
  expect(r.resume.reason).toBe('LIVE_HAS_PRIORITY');
  expect(r.canDispatch).toBe(false);
 });
 it('agrees with AutoDJ to scheduled gate at active slot boundary',()=>{
  const r=inspect({current:src('AUTO_DJ','track'),handoverTarget:src('SCHEDULED','slot'),
    scheduleKnown:true,scheduleActive:true});
  expect(r.handover.allowed).toBe(true);
  expect(r.resume.reason).toBe('SCHEDULE_SOURCE_UNRESOLVED');
  expect(r.consistent).toBe(false);
 });
 it('requires current scheduled authority rather than saved track',()=>{
  const r=inspect({previous:src('AUTO_DJ','old'),current:{...src('SCHEDULED','new'),slotId:'slot-2'},
    scheduleKnown:true,scheduleActive:true});
  expect(r.resume.slotId).toBe('slot-2');
  expect(r.resume.executable).toBe(false);
 });
 it('blocks unknown schedule on both gates',()=>{
  const r=inspect({current:src('AUTO_DJ','track'),handoverTarget:src('SCHEDULED','slot')});
  expect(r.handover.reason).toBe('SCHEDULE_AUTHORITY_UNKNOWN');
  expect(r.resume.reason).toBe('SCHEDULE_UNKNOWN');
 });
 it('blocks handover while live broadcast has priority',()=>{
  const r=inspect({current:src('AUTO_DJ','track'),handoverTarget:src('SCHEDULED','slot'),
    scheduleKnown:true,scheduleActive:true,publicLive:true});
  expect(r.handover.reason).toBe('PUBLIC_LIVE_PRIORITY');
  expect(r.resume.reason).toBe('LIVE_HAS_PRIORITY');
 });
});
