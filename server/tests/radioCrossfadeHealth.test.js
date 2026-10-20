import {describe,it,expect} from 'vitest';
import {inspectPcmBoundary,createCrossfadeQualityState,observePcmBoundary} from '../src/lib/radioCrossfadeHealth.js';
const pcm=(value,frames=480)=>{const b=Buffer.alloc(frames*4);for(let i=0;i<b.length;i+=4){b.writeInt16LE(value,i);b.writeInt16LE(value,i+2);}return b;};
describe('PCM crossfade continuity observations',()=>{
 it('accepts consecutive matching frames',()=>{
  const result=inspectPcmBoundary(pcm(500),pcm(500));
  expect(result.maxSampleJump).toBe(0);
  expect(result.abruptJump).toBe(false);
  expect(result.silenceRatio).toBe(0);
 });
 it('identifies very large boundary jumps',()=>{
  const result=inspectPcmBoundary(pcm(-15000),pcm(15000));
  expect(result.maxSampleJump).toBe(30000);
  expect(result.abruptJump).toBe(true);
 });
 it('measures exact zero PCM without misclassifying normal audio',()=>{
  expect(inspectPcmBoundary(pcm(100),pcm(0)).silenceRatio).toBe(1);
  expect(inspectPcmBoundary(pcm(100),pcm(200)).silenceRatio).toBe(0);
 });
 it('keeps cumulative counters and last observation',()=>{
  let state=createCrossfadeQualityState();
  state=observePcmBoundary(state,pcm(-15000),pcm(15000),Date.parse('2026-10-21T12:00:00Z'));
  expect(state).toMatchObject({inspected:1,suspiciousJumps:1,lastJump:30000});
  state=observePcmBoundary(state,pcm(500),pcm(500),Date.parse('2026-10-21T12:00:01Z'));
  expect(state).toMatchObject({inspected:2,suspiciousJumps:1,lastJump:0});
 });
 it('rejects invalid PCM frame boundaries',()=>{
  expect(()=>inspectPcmBoundary(Buffer.alloc(3),pcm(10))).toThrow();
 });
});
