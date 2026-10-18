import {describe,it,expect} from 'vitest';
import {PcmFrameBuffer} from '../src/lib/radioPcmFrameBuffer.js';
describe('PCM frame alignment staging',()=>{
 it('carries incomplete stereo frame into next chunk in order',()=>{
  const buffer=new PcmFrameBuffer({frameBytes:4,maxBytes:64});
  expect(buffer.push(Buffer.from([1,2,3]))).toBeNull();
  expect([...buffer.push(Buffer.from([4,5,6,7,8,9]))]).toEqual([1,2,3,4,5,6,7,8]);
  expect(buffer.bufferedBytes).toBe(1);
  expect([...buffer.push(Buffer.from([10,11,12]))]).toEqual([9,10,11,12]);
  expect(buffer.totalBytes).toBe(12);
 });
 it('enforces bounded input and rejects invalid chunk types',()=>{
  const buffer=new PcmFrameBuffer({frameBytes:4,maxBytes:8});
  expect(()=>buffer.push(Buffer.alloc(12))).toThrow(RangeError);
  expect(()=>buffer.push('not-buffer')).toThrow(TypeError);
 });
 it('drops only incomplete trailing frame at decoder boundary',()=>{
  const buffer=new PcmFrameBuffer();
  buffer.push(Buffer.from([1,2,3]));
  buffer.finish();
  expect(buffer.droppedTailBytes).toBe(3);
  expect(buffer.bufferedBytes).toBe(0);
 });
 it('handles frame complete inputs without changing bytes',()=>{
  const data=Buffer.from([0,255,7,9,10,20,30,40]);
  const buffer=new PcmFrameBuffer();
  expect(buffer.push(data).equals(data)).toBe(true);
 });
});