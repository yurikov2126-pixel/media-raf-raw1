import {describe,it,expect} from 'vitest';
import {RadioPcmLabSoakTelemetry} from '../src/lib/radioPcmLabSoakTelemetry.js';
describe('PCM lab soak monitoring',()=>{
 it('measures late ticks, worst gap and bounded p95 latency',()=>{
  const t=new RadioPcmLabSoakTelemetry({historySize:3});
  t.tick(1000,{ok:true});
  t.tick(1020,{ok:true});
  t.tick(1045,{ok:true});
  t.tick(1065,{ok:true});
  t.tick(1095,{ok:true});
  const s=t.snapshot(1100);
  expect(s).toMatchObject({ticks:5,deadlineMisses:2,maxGapMs:30,maxLatenessMs:10,
   p95LatenessMs:10,uptimeMs:100,connectedToEncoder:false,changeApplied:false});
 });
 it('records incoming frame failures without retaining audio',()=>{
  const t=new RadioPcmLabSoakTelemetry({historySize:2});
  t.receive({ok:true},120);
  t.receive({ok:false,reason:'SEQUENCE_GAP'},200);
  t.tick(1000,{ok:false,reason:'BUFFER_UNDERRUN'});
  const s=t.snapshot(1000);
  expect(s.acceptedFrames).toBe(1);
  expect(s.failedFrames).toBe(1);
  expect(s.highWaterBufferedMs).toBe(200);
  expect(s.failures.map(x=>x.reason)).toEqual(['SEQUENCE_GAP','BUFFER_UNDERRUN']);
  expect(JSON.stringify(s)).not.toContain('pcm');
 });
 it('resets counters when a new intake session begins',()=>{
  const t=new RadioPcmLabSoakTelemetry();
  t.tick(1000,{ok:true});t.receive({ok:false,reason:'ERROR'},80);
  t.reset();
  expect(t.snapshot(2000)).toMatchObject({ticks:0,acceptedFrames:0,failedFrames:0,
   uptimeMs:0,highWaterBufferedMs:0});
 });
 it('flags reversed wall clock and refuses invalid capacity',()=>{
  const t=new RadioPcmLabSoakTelemetry();
  t.tick(1000,{ok:true});t.tick(900,{ok:true});
  expect(t.snapshot().failures.at(-1).reason).toBe('CLOCK_REVERSED');
  expect(()=>new RadioPcmLabSoakTelemetry({historySize:0})).toThrow(TypeError);
 });
});
