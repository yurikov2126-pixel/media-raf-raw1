import {describe,it,expect} from 'vitest';
import {PcmGatewayClock} from '../src/lib/radioPcmGatewayClock.js';
describe('radio internal media gateway clock',()=>{
 it('accepts 48kHz sequential stereo frames',()=>{
  const q=new PcmGatewayClock();
  expect(q.validate({pcm:Buffer.alloc(1920),frameIndex:0}).expectedFrame).toBe(480);
  expect(q.validate({pcm:Buffer.alloc(1920),frameIndex:480}).expectedFrame).toBe(960);
  expect(q.snapshot().discontinuities).toBe(0);
 });
 it('rejects lost, duplicate and reordered packets without advancing clock',()=>{
  const q=new PcmGatewayClock();
  q.validate({pcm:Buffer.alloc(1920),frameIndex:0});
  expect(()=>q.validate({pcm:Buffer.alloc(1920),frameIndex:0})).toThrow('Discontinuous');
  expect(()=>q.validate({pcm:Buffer.alloc(1920),frameIndex:1440})).toThrow('Discontinuous');
  expect(q.snapshot().expectedFrame).toBe(480);
  expect(q.snapshot().discontinuities).toBe(2);
 });
 it('rejects oversized or malformed PCM, and resets on new session',()=>{
  const q=new PcmGatewayClock();
  expect(()=>q.validate({pcm:Buffer.alloc(20000),frameIndex:0})).toThrow(RangeError);
  expect(()=>q.validate({pcm:Buffer.alloc(3),frameIndex:0})).toThrow(TypeError);
  q.validate({pcm:Buffer.alloc(4),frameIndex:0});q.reset();
  expect(q.snapshot().expectedFrame).toBeNull();
 });
});
