import {describe,it,expect} from 'vitest';
import {RadioPrivateLivePcmQueue} from '../src/lib/radioPrivateLivePcmQueue.js';
const frame=n=>{const b=Buffer.alloc(3840);b.writeInt16LE(n,0);return b;};
describe('private live PCM cursor queue',()=>{
 it('returns contiguous blocks without replay',()=>{
  const q=new RadioPrivateLivePcmQueue({maxFrames:10});
  for(let i=0;i<5;i++)q.push(frame(i),1000+i*20);
  const first=q.read({max:2,nowMs:1100});
  expect(first.frames.map(f=>f.sequence)).toEqual([3,4]);
  q.push(frame(5),1120);
  const next=q.read({after:4,max:8,nowMs:1130});
  expect(next.frames.map(f=>f.sequence)).toEqual([5]);
  expect(next.connectedToEncoder).toBe(false);
  expect(next.changeApplied).toBe(false);
 });
 it('fails closed when a slow reader misses bounded frames',()=>{
  const q=new RadioPrivateLivePcmQueue({maxFrames:10});
  for(let i=0;i<20;i++)q.push(frame(i),1000+i*20);
  expect(q.read({after:2,nowMs:1400}).reason).toBe('CURSOR_EXPIRED');
  expect(q.snapshot().bufferedFrames).toBe(10);
 });
 it('refuses stale data, erases old sessions and validates input',()=>{
  const q=new RadioPrivateLivePcmQueue();
  expect(q.read().reason).toBe('PCM_STALE');
  expect(()=>q.push(Buffer.alloc(2),1000)).toThrow(TypeError);
  q.push(frame(1),1000);
  expect(q.read({after:null,nowMs:2501}).reason).toBe('PCM_STALE');
  q.reset();
  expect(q.snapshot().bufferedFrames).toBe(0);
  expect(()=>q.read({after:-2})).toThrow(TypeError);
 });
});