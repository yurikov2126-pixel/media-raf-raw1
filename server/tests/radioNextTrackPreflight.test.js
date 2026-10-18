import {describe,it,expect} from 'vitest';
import {preflightNextTracks} from '../src/lib/radioNextTrackPreflight.js';
const now=Date.parse('2026-10-18T12:00:00Z');
const items=[
 {id:'a',name:'A',storageKey:'a.mp3',playDurationMs:30000},
 {id:'b',name:'B',storageKey:'b.mp3',playDurationMs:40000}
];
const input={items,nowMs:now,cooldownMinutes:30,requestedMs:2000,
 untilMs:now+60000,assetsRoot:'/music'};
describe('radio file preflight',()=>{
 it('validates both sources without launching audio',async()=>{
  const paths=[];
  const result=await preflightNextTracks({...input,access:async path=>{paths.push(path);}});
  expect(result.status).toBe('READY');
  expect(result.overlapMs).toBe(2000);
  expect(paths).toHaveLength(2);
 });
 it('warns about missing next track without claiming a blend',async()=>{
  const result=await preflightNextTracks({...input,access:async path=>{
   if(path.endsWith('b.mp3'))throw Error('missing');
  }});
  expect(result.status).toBe('SECOND_MISSING');
  expect(result.overlapMs).toBe(0);
 });
 it('respects next scheduled broadcast',async()=>{
  const result=await preflightNextTracks({...input,untilMs:now+100,access:async()=>{}});
  expect(result.status).toBe('SOLO');
  expect(result.overlapMs).toBe(0);
 });
 it('does not reserve recent second source',async()=>{
  const result=await preflightNextTracks({...input,history:[{id:'b',startedAt:'2026-10-18T11:59:00Z'}],access:async()=>{}});
  expect(result.status).toBe('SOLO');
  expect(result.secondId).toBeNull();
 });
});