import {describe,it,expect} from 'vitest';
import {RadioIsolatedPcmLab} from '../src/lib/radioIsolatedPcmLab.js';
const frame=(n,value=1200)=>{const pcm=Buffer.alloc(3840);for(let i=0;i<3840;i+=2)pcm.writeInt16LE(value,i);
 return {pcm,frameIndex:n*960};};
describe('Audio Engine 5.1 isolated PCM lab',()=>{
 it('mixes real PCM frames with offline test signal and discards output',()=>{
  const lab=new RadioIsolatedPcmLab({prebufferFrames:2});
  expect(lab.push(frame(0),1000).ok).toBe(true);
  expect(lab.tick(1000).buffering).toBe(true);
  lab.push(frame(1),1005);lab.push(frame(2),1010);
  const a=lab.tick(1010);
  expect(a).toMatchObject({ok:true,frameIndex:0,outputDiscarded:true,connectedToEncoder:false});
  const b=lab.tick(1030);
  expect(b.frameIndex).toBe(960);
  const snap=lab.snapshot(1030);
  expect(snap.framesMixed).toBe(2);
  expect(snap.peak).toBeGreaterThan(0);
  expect(snap.checksum).toBeGreaterThan(0);
  expect(snap.changeApplied).toBe(false);
  expect('pcm' in a).toBe(false);
 });
 it('fails closed on missing frame or overlong clock tick',()=>{
  const lab=new RadioIsolatedPcmLab({prebufferFrames:1});
  lab.push(frame(0),1000);lab.tick(1000);
  expect(lab.tick(1020).reason).toBe('BUFFER_UNDERRUN');
  expect(lab.snapshot(1020).underruns).toBe(1);
  const reset=new RadioIsolatedPcmLab({prebufferFrames:1});
  reset.push(frame(0),1000);reset.push(frame(1),1001);reset.tick(1000);
  expect(reset.tick(1041).reason).toBe('TIMER_OVERRUN');
 });
 it('detects out-of-order frames, reset clears cross-session data',()=>{
  const lab=new RadioIsolatedPcmLab({prebufferFrames:1});
  lab.push(frame(0),1000);
  expect(lab.push(frame(2),1010).reason).toBe('SEQUENCE_GAP');
  expect(lab.tick(1010).ok).toBe(false);
  lab.reset();
  expect(lab.push(frame(0),2000).ok).toBe(true);
  expect(lab.snapshot(2000).framesMixed).toBe(0);
 });
 it('refuses malformed frames, stale voice and impossible configuration',()=>{
  expect(()=>new RadioIsolatedPcmLab({frequencyHz:24000})).toThrow(TypeError);
  const lab=new RadioIsolatedPcmLab({prebufferFrames:1,staleMs:50});
  expect(lab.push({pcm:Buffer.alloc(1),frameIndex:0},1000).ok).toBe(false);
  lab.reset();lab.push(frame(0),1000);
  expect(lab.tick(1051).reason).toBe('STALE_INPUT');
 });
});
