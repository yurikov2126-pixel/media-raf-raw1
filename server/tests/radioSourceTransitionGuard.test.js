import {describe,it,expect} from 'vitest';
import {reserveSourceTransition,validateSourceTransition} from '../src/lib/radioSourceTransitionGuard.js';
const auto={id:'a',mode:'AUTO_DJ'},show={id:'b',mode:'SCHEDULED'};
describe('Cross-source handover authority',()=>{
 it('reserves only approved AutoDJ to scheduled handover',()=>{
  const result=reserveSourceTransition({source:auto,target:show,sourceReady:true,targetReady:true,
    slotKnown:true,scheduledActive:true,overlapMs:1500});
  expect(result).toMatchObject({allowed:true,type:'AUTO_DJ>SCHEDULED'});
  expect(result.controller.start().ok).toBe(true);
 });
 it('reserves return to AutoDJ only after schedule releases priority',()=>{
  expect(validateSourceTransition({source:show,target:auto,slotKnown:true,scheduledActive:false}))
    .toMatchObject({allowed:true,type:'SCHEDULED>AUTO_DJ'});
  expect(validateSourceTransition({source:show,target:auto,slotKnown:true,scheduledActive:true}).allowed).toBe(false);
 });
 it('does not hand a live or unknown schedule to the music engine',()=>{
  expect(validateSourceTransition({source:auto,target:show,slotKnown:false,scheduledActive:true}).allowed).toBe(false);
  expect(validateSourceTransition({source:auto,target:show,slotKnown:true,scheduledActive:true,publicLive:true}).allowed).toBe(false);
 });
 it('missing target has a non-replaying fallback to existing source',()=>{
  const result=reserveSourceTransition({source:auto,target:show,slotKnown:true,scheduledActive:true,
    sourceReady:true,targetReady:false});
  expect(result).toMatchObject({allowed:false,reason:'TARGET_NOT_READY',
    fallback:{mode:'SINGLE_SOURCE',sourceId:'a',skipTargetFrames:0}});
 });
 it('rejects invalid mixed modes, duplicate IDs and overlap bounds',()=>{
  expect(validateSourceTransition({source:auto,target:auto,slotKnown:true,scheduledActive:true}).allowed).toBe(false);
  expect(validateSourceTransition({source:auto,target:{id:'c',mode:'AUTO_DJ'},slotKnown:true,scheduledActive:true}).allowed).toBe(false);
  expect(validateSourceTransition({source:auto,target:show,slotKnown:true,scheduledActive:true,overlapMs:6000}).allowed).toBe(false);
 });
});
