import {describe,it,expect,vi} from 'vitest';
import {collectRadioHandoverObservation} from '../src/lib/radioHandoverObservation.js';
const now=new Date('2026-10-19T10:00:00.000Z');
const prisma=(active=false,revision=5n)=>({
 $transaction:async(fn,options)=>{
  expect(options.isolationLevel).toBe('RepeatableRead');
  return fn({
   radioScheduleRevision:{findUnique:vi.fn(async()=>({revision}))},
   radioScheduleSlot:{findFirst:vi.fn(async()=>active?{id:'slot',startAt:now,endAt:new Date(now.getTime()+60000)}:null)},
  });
 },
});
const worker={enabled:true,session:{active:true},timedShadow:{enabled:true,state:'READY',
 fresh:true,pcmLastAt:now.getTime()-40,bufferedMs:140,connectedToEncoder:false}};
describe('transactional handover observation',()=>{
 it('reads a DB sequence and a consistent schedule snapshot',async()=>{
  const a=await collectRadioHandoverObservation({prisma:prisma(),workerStatus:worker,
   connected:true,gatewayRunning:true,presenterId:'a',leaseId:'lease-1',now});
  expect(a).toMatchObject({scheduleRevision:5,scheduledActive:false,pcmReady:true,changeApplied:false});
 });
 it('sees an active approved slot and blocks presenter readiness',async()=>{
  const a=await collectRadioHandoverObservation({prisma:prisma(true,6n),workerStatus:worker,
   connected:true,gatewayRunning:true,now});
  expect(a.scheduledActive).toBe(true);
  expect(a.pcmReady).toBe(false);
  expect(a.scheduleRevision).toBe(6);
 });
 it('rejects unsafe, missing, and invalid DB revision values',async()=>{
  for(const revision of [null,BigInt(Number.MAX_SAFE_INTEGER)+1n]){
   await expect(collectRadioHandoverObservation({prisma:prisma(false,revision),workerStatus:worker,now}))
    .rejects.toThrow(/SCHEDULE_REVISION/);
  }
 });
 it('fails closed on DB outages',async()=>{
  await expect(collectRadioHandoverObservation({prisma:{$transaction:async()=>{throw Error('DB_DOWN');}},now}))
   .rejects.toThrow('DB_DOWN');
 });
});
