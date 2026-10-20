import {describe,it,expect} from 'vitest';
import {RadioDeferredPcmTail} from '../src/lib/radioDeferredPcmTail.js';
const pcm=(frames,begin=0)=>{const b=Buffer.alloc(frames*4);for(let i=0;i<frames;i++){b.writeInt16LE(begin+i,i*4);b.writeInt16LE(begin+i,i*4+2);}return b;};
describe('deferred PCM tail',()=>{
 it('delivers all frames once after explicit flush',()=>{
  const q=new RadioDeferredPcmTail({holdMs:250});
  const source=pcm(16000),parts=[];
  for(let i=0;i<source.length;i+=4*127)parts.push(q.push(source.subarray(i,Math.min(source.length,i+4*127))));
  parts.push(q.flush());
  expect(Buffer.concat(parts)).toEqual(source);
  expect(q.snapshot().heldBytes).toBe(0);
  expect(q.flush().length).toBe(0);
 });
 it('returns only the uncommitted end for mixing',()=>{
  const q=new RadioDeferredPcmTail({holdMs:250});
  const source=pcm(13000);
  const committed=q.push(source);
  const held=q.takeTail();
  expect(held.length).toBe(12000*4);
  expect(Buffer.concat([committed,held])).toEqual(source);
  expect(q.takeTail().length).toBe(0);
 });
 it('rejects partial PCM frames and oversized holding windows',()=>{
  expect(()=>new RadioDeferredPcmTail({holdMs:8000})).toThrow();
  expect(()=>new RadioDeferredPcmTail().push(Buffer.alloc(3))).toThrow();
 });
});
