import {describe,it,expect} from 'vitest';
import {planSourceHandover,targetSeekAfterHandover} from '../src/lib/radioSourceHandoverClock.js';
describe('cross-source timing authority',()=>{
 const standard={fromMode:'AUTO_DJ',toMode:'SCHEDULED',nowMs:10000,boundaryMs:20000,
  overlapMs:1500,sourceRemainingMs:15000,targetDurationMs:200000};
 it('starts overlap before the absolute scheduled boundary',()=>{
  expect(planSourceHandover(standard)).toMatchObject({allowed:true,startMs:18500,endMs:20000,
   targetSeekAfterMs:1500});
 });
 it('does not skip the initial slot when unable to start in time',()=>{
  expect(planSourceHandover({...standard,nowMs:19000})).toMatchObject({
   allowed:false,reason:'OVERLAP_START_MISSED'});
 });
 it('honors explicit finish-current-track option',()=>{
  expect(planSourceHandover({...standard,finishTrackBeforeSchedule:true}))
   .toMatchObject({allowed:false,reason:'FINISH_TRACK_POLICY'});
 });
 it('refuses shortened audio rather than repeating target head',()=>{
  expect(planSourceHandover({...standard,targetDurationMs:1000}).allowed).toBe(false);
 });
 it('supports reverse source without shifting slot',()=>{
  expect(planSourceHandover({...standard,fromMode:'SCHEDULED',toMode:'AUTO_DJ'}).allowed).toBe(true);
 });
 it('converts already mixed frames into exact successor seek',()=>{
  expect(targetSeekAfterHandover({consumedFrames:72000,baseSeekMs:200})).toBe(1700);
  expect(()=>targetSeekAfterHandover({consumedFrames:-1})).toThrow();
 });
});
