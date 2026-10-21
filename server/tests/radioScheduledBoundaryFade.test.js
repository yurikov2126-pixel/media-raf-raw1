import {describe,it,expect} from 'vitest';
import {scheduledBoundaryFadePolicy} from '../src/lib/radioScheduledBoundaryFade.js';
describe('opt-in scheduled boundary fade',()=>{
 it('is disabled by default',()=>{
  expect(scheduledBoundaryFadePolicy({status:'SCHEDULED',isLastTrack:true,remainingMs:2000}).fadeOut).toBe(false);
 });
 it('permits fallback fade on the last scheduled source only',()=>{
  expect(scheduledBoundaryFadePolicy({enabled:true,status:'SCHEDULED',isLastTrack:true,remainingMs:4000})).toEqual({fadeOut:true,fadeMs:750});
  expect(scheduledBoundaryFadePolicy({enabled:true,status:'SCHEDULED',isLastTrack:false,remainingMs:4000}).fadeOut).toBe(false);
 });
 it('does not apply a second fade to a genuine PCM overlap',()=>{
  expect(scheduledBoundaryFadePolicy({enabled:true,status:'SCHEDULED',isLastTrack:true,crossfadeEligible:true,remainingMs:4000}).fadeOut).toBe(false);
  expect(scheduledBoundaryFadePolicy({enabled:true,status:'SCHEDULED',isLastTrack:true,usableBlend:true,remainingMs:4000}).fadeOut).toBe(false);
 });
 it('leaves AutoDJ unchanged and clamps fades to the remaining window',()=>{
  expect(scheduledBoundaryFadePolicy({enabled:true,status:'AUTO_DJ',isLastTrack:true,remainingMs:4000}).fadeOut).toBe(false);
  expect(scheduledBoundaryFadePolicy({enabled:true,status:'SCHEDULED',isLastTrack:true,remainingMs:500}).fadeMs).toBe(500);
 });
});
