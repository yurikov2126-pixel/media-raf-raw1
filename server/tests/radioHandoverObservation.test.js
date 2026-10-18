import {describe,it,expect,vi} from 'vitest';
import {collectRadioHandoverObservation} from '../src/lib/radioHandoverObservation.js';
const now=new Date('2026-10-19T10:00:00.000Z');
const slot={id:'s1',playlistId:'p1',startAt:new Date('2026-10-19T11:00:00Z'),endAt:new Date('2026-10-19T12:00:00Z')};
const prisma=active=>({radioScheduleSlot:{
 findFirst:vi.fn(async()=>active?{...slot,startAt:new Date('2026-10-19T09:00:00Z')}:null),
 findMany:vi.fn(async()=>[slot])}});
const worker={enabled:true,session:{active:true},timedShadow:{enabled:true,
  state:'READY',fresh:true,pcmLastAt:now.getTime()-50,bufferedMs:140,connectedToEncoder:false}};
describe('server-only handover observation',()=>{
 it('produces deterministic schedule fingerprint for unchanged approved slots',async()=>{
  const a=await collectRadioHandoverObservation({prisma:prisma(false),workerStatus:worker,
    connected:true,gatewayRunning:true,presenterId:'presenter',leaseId:'lease',now});
  const b=await collectRadioHandoverObservation({prisma:prisma(false),workerStatus:worker,
    connected:true,gatewayRunning:true,presenterId:'presenter',leaseId:'lease',now});
  expect(a.scheduleRevision).toBe(b.scheduleRevision);
  expect(a.pcmReady).toBe(true);
  expect(a.changeApplied).toBe(false);
  expect(a.connectedToEncoder).toBe(false);
 });
 it('blocks active slots and absent PCM',async()=>{
  const a=await collectRadioHandoverObservation({prisma:prisma(true),workerStatus:worker,
    connected:true,gatewayRunning:true,now});
  expect(a.scheduledActive).toBe(true);
  expect(a.pcmReady).toBe(false);
  const b=await collectRadioHandoverObservation({prisma:prisma(false),workerStatus:null,now});
  expect(b.pcmReady).toBe(false);
 });
 it('fails if the schedule authority database is unavailable',async()=>{
  const broken={radioScheduleSlot:{findFirst:async()=>{throw Error('db-down');},
    findMany:async()=>[]}};
  await expect(collectRadioHandoverObservation({prisma:broken,workerStatus:worker,now}))
    .rejects.toThrow('db-down');
 });
});
