import {describe,it,expect} from 'vitest';
import {RadioPublicLiveGate} from '../src/lib/radioPublicLiveGate.js';
const frame=()=>Buffer.alloc(3840,1);
describe('public LIVE source gate',()=>{
 it('cannot go on air by microphone connection alone',()=>{
  const g=new RadioPublicLiveGate();
  for(let i=0;i<12;i++)g.ingest(frame(),'a',1000+i*20);
  expect(g.snapshot().onAir).toBe(false);
  expect(g.start('bad',1250).ok).toBe(false);
  expect(g.start('a',1250).ok).toBe(true);
  expect(g.take(1260)?.length).toBe(3840);
 });
 it('fences wrong source and returns to Auto-DJ on lost PCM',()=>{
  const g=new RadioPublicLiveGate();
  for(let i=0;i<12;i++)g.ingest(frame(),'token',1000+i*20);
  g.start('token',1250);
  expect(g.ingest(frame(),'other',1260)).toBe(false);
  expect(g.take(3000)).toBeNull();
  expect(g.snapshot().onAir).toBe(false);
  expect(g.snapshot().reason).toBe('PCM_TIMEOUT');
 });
 it('requires sufficient current audio, bounded buffers and clears on stop',()=>{
  const g=new RadioPublicLiveGate();
  expect(g.start('one',1000).reason).toBe('SESSION_MISMATCH');
  for(let i=0;i<200;i++)g.ingest(frame(),'one',1000+i*20);
  expect(g.snapshot().bufferedFrames).toBe(50);
  expect(g.start('one',5000).reason).toBe('PCM_NOT_READY');
  expect(g.start('one',5000-500).ok).toBe(true);
  g.stop('PRESENTER_ENDED');
  expect(g.snapshot().bufferedFrames).toBe(0);
  expect(g.snapshot().mode).toBe('AUTO_DJ');
 });
});
