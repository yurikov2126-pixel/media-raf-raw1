import {describe,expect,it} from 'vitest';
import {crossfadePlan,withinBroadcastBoundary} from '../src/lib/radioCrossfade.js';
const tracks=[{id:'a',playDurationMs:10000,cue:{inMs:2000,outMs:12000}},{id:'b',playDurationMs:12000,cue:{inMs:0,outMs:12000}}];
describe('Auto-DJ crossfade plan',()=>{
 it('keeps solo sections and overlaps within cue boundaries',()=>{
  expect(crossfadePlan(tracks,0,1000)).toMatchObject({mode:'SOLO',index:0,seekMs:3000});
  expect(crossfadePlan(tracks,8000,1000)).toMatchObject({mode:'BLEND',index:0,seekMs:11000,nextSeekMs:0,remainingMs:1000});
  expect(crossfadePlan(tracks,9000,1000)).toMatchObject({mode:'SOLO',index:1,seekMs:1000});
 });
 it('is deterministic across period wrap',()=>{
  expect(crossfadePlan(tracks,20000,1000)).toMatchObject({mode:'SOLO',index:0,seekMs:3000});
 });
 it('refuses impossible and single-file mixes',()=>{
  expect(crossfadePlan(tracks.slice(0,1),1000,1000)).toBeNull();
  expect(crossfadePlan(tracks,1000,0)).toBeNull();
 });
 it('never crosses hard-start broadcast boundary',()=>{
  expect(withinBroadcastBoundary(2000,1100,1000)).toBe(100);
 });
});