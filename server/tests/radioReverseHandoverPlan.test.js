import {describe,it,expect} from 'vitest';
import {planReverseHandover,verifyReverseHandoverCommit} from '../src/lib/radioReverseHandoverPlan.js';
const base={nowMs:10000,slotEndMs:20000,remainingMs:12000,
 overlapMs:1500,lastScheduledTrack:true,autoDjEnabled:true,
 target:{id:'a',seekMs:200},prepared:{assetId:'a',seekMs:200}};
describe('scheduled to AutoDJ eligibility',()=>{
 it('permits only an available matching post-show target',()=>{
  expect(planReverseHandover(base)).toMatchObject({allowed:true,startMs:18500,endMs:20000,targetSeekAfterMs:1700});
 });
 it('honors live, competing show and disabled AutoDJ',()=>{
  for(const patch of [{publicLive:true},{competingSlot:true},{autoDjEnabled:false},
   {lastScheduledTrack:false},{prepared:{assetId:'b',seekMs:200}}]){
   expect(planReverseHandover({...base,...patch}).allowed).toBe(false);
  }
 });
 it('does not mix after the absolute overlap start',()=>{
  expect(planReverseHandover({...base,nowMs:18501})).toMatchObject({allowed:false,reason:'START_MISSED'});
 });
 it('rejects a changed queued track and incomplete target frames',()=>{
  expect(verifyReverseHandoverCommit({plannedTargetId:'a',selectedTargetId:'b',
   consumedFrames:72000,expectedFrames:72000}).allowed).toBe(false);
  expect(verifyReverseHandoverCommit({plannedTargetId:'a',selectedTargetId:'a',
   consumedFrames:71000,expectedFrames:72000}).allowed).toBe(false);
  expect(verifyReverseHandoverCommit({plannedTargetId:'a',selectedTargetId:'a',
   consumedFrames:72000,expectedFrames:72000})).toMatchObject({allowed:true,seekDeltaMs:1500});
 });
});
