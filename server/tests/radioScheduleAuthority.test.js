import {describe,it,expect,vi} from 'vitest';
import {readRadioScheduleAuthority,scheduleAwareReadiness} from '../src/lib/radioScheduleAuthority.js';
describe('approved schedule authority for radio health',()=>{
 const now=new Date('2026-10-19T12:00:00Z');
 it('queries only approved slots overlapping the server clock',async()=>{
  const findFirst=vi.fn(async()=>({id:'slot-1',playlistId:'approved',startAt:now,endAt:new Date(now.getTime()+3600000)}));
  const a=await readRadioScheduleAuthority({radioScheduleSlot:{findFirst}},{now});
  expect(a).toMatchObject({known:true,active:true,slotId:'slot-1',sourceReady:false});
  const query=findFirst.mock.calls[0][0];
  expect(query.where.playlist.status).toBe('APPROVED');
  expect(query.where.startAt.lte).toEqual(now);
  expect(query.where.endAt.gt).toEqual(now);
 });
 it('reports a clear schedule without inventing media readiness',async()=>{
  const a=await readRadioScheduleAuthority({radioScheduleSlot:{findFirst:async()=>null}},{now});
  expect(a).toMatchObject({known:true,active:false,sourceReady:false,slotId:null});
 });
 it('blocks readiness when schedule database status is unknown',()=>{
  const x=scheduleAwareReadiness({authority:null,readiness:{diagnosticReady:true,blockers:[]}});
  expect(x.scheduleKnown).toBe(false);
  expect(x.diagnosticReady).toBe(false);
  expect(x.blockers).toContain('SCHEDULE_AUTHORITY_UNAVAILABLE');
  expect(x.changeApplied).toBe(false);
 });
 it('never claims broadcast handover even when schedule and shadow look ready',()=>{
  const x=scheduleAwareReadiness({authority:{known:true,active:false,sourceReady:false,checkedAt:1,slotId:null},
    readiness:{diagnosticReady:true,blockers:[]}});
  expect(x.diagnosticReady).toBe(true);
  expect(x.liveOutputConnected).toBe(false);
  expect(x.changeApplied).toBe(false);
 });
 it('propagates a source failure to the caller',async()=>{
  await expect(readRadioScheduleAuthority({radioScheduleSlot:{findFirst:async()=>{throw Error('db down');}}},{now}))
    .rejects.toThrow('db down');
 });
});