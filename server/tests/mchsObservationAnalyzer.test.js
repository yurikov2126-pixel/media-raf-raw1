import { describe,it,expect,vi } from 'vitest';
import { analyzeMchsObservationBatch,startMchsObservationAnalyzer } from '../src/lib/mchsObservationAnalyzer.js';
const event={title:'РАКЕТНАЯ ОПАСНОСТЬ',body:'',occurredAt:new Date().toISOString()};
describe('MCHS background observation analyzer',()=>{
 it('does nothing unless explicitly enabled',()=>{
  const analyzer=startMchsObservationAnalyzer({enabled:false});
  expect(analyzer.enabled).toBe(false);analyzer.stop();
 });
 it('atomically marks observed items and records reason',async()=>{
  const update=vi.fn(async()=>({}));
  const upsert=vi.fn(async()=>({}));
  const db={$transaction:fn=>fn({$executeRaw:async()=>{},safetyMchsQueueItem:{
   findMany:async()=>[{id:'q1',event}],update
  },safetyMchsQueueHistory:{upsert}})};
  const result=await analyzeMchsObservationBatch(db);
  expect(result.processed).toBe(1);
  expect(result.playbackEnabled).toBe(false);
  expect(update).toHaveBeenCalledWith(expect.objectContaining({data:{status:'ANALYZED'}}));
  expect(upsert).toHaveBeenCalledTimes(1);
 });
 it('does not write when there are no pending items',async()=>{
  const upsert=vi.fn();
  const db={$transaction:fn=>fn({$executeRaw:async()=>{},safetyMchsQueueItem:{
   findMany:async()=>[],update:vi.fn()
  },safetyMchsQueueHistory:{upsert}})};
  expect((await analyzeMchsObservationBatch(db)).processed).toBe(0);
  expect(upsert).not.toHaveBeenCalled();
 });
});
