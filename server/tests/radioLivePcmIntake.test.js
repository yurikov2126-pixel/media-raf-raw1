import {describe,it,expect} from 'vitest';
import {LivePcmIntake} from '../src/lib/radioLivePcmIntake.js';
describe('isolated live PCM intake',()=>{
 it('requires 4-byte aligned audio frames and keeps copies',()=>{
  const q=new LivePcmIntake({maxBytes:16});
  expect(()=>q.accept(Buffer.alloc(3))).toThrow(TypeError);
  const b=Buffer.alloc(8,1);
  q.accept(b,1000);b.fill(0);
  expect([...q.chunks[0]]).toEqual(Array(8).fill(1));
  expect(q.frames).toBe(2);
 });
 it('drops oldest bytes when bounded staging fills',()=>{
  const q=new LivePcmIntake({maxBytes:16});
  q.accept(Buffer.alloc(12),1000);q.accept(Buffer.alloc(12),2000);
  expect(q.bytes).toBe(12);expect(q.droppedBytes).toBe(12);
 });
 it('marks stale input unavailable and does not claim encoder connection',()=>{
  const q=new LivePcmIntake({timeoutMs:5000});
  q.accept(Buffer.alloc(8),1000);
  expect(q.ready(2000)).toBe(true);
  expect(q.ready(6001)).toBe(false);
  q.reset();expect(q.ready(2000)).toBe(false);
 });
 it('rejects oversized packet before staging',()=>{
  expect(()=>new LivePcmIntake({maxBytes:16}).accept(Buffer.alloc(20))).toThrow(RangeError);
 });
});
