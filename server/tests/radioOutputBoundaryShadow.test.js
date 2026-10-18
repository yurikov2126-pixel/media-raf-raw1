import {describe,it,expect} from 'vitest';
import {inspectRadioOutputBoundary} from '../src/lib/radioOutputBoundaryShadow.js';
const base={scheduleKnown:true,scheduledActive:false,scheduleRevision:22,
 preparedRevision:22,sessionValid:true,presenterLease:'a',preparedLease:'a',
 pcmState:{state:'READY',connectedToEncoder:false,bufferedMs:200,pcmLastAt:9800},nowMs:10000};
describe('isolated output boundary admission',()=>{
 it('permits only a shadow simulation',()=>{
  expect(inspectRadioOutputBoundary(base)).toEqual({canSimulatePresenter:true,blockers:[],
   fallback:null,changeApplied:false,connectedToEncoder:false});
 });
 it('refuses scheduled broadcasts and changed revisions',()=>{
  expect(inspectRadioOutputBoundary({...base,scheduledActive:true}).blockers).toContain('SCHEDULE_RESERVED');
  expect(inspectRadioOutputBoundary({...base,scheduleRevision:23}).blockers).toContain('REVISION_CHANGED');
 });
 it('refuses a replaced lease or stale audio',()=>{
  expect(inspectRadioOutputBoundary({...base,presenterLease:'b'}).blockers).toContain('LEASE_REVOKED');
  expect(inspectRadioOutputBoundary({...base,pcmState:{...base.pcmState,pcmLastAt:8000}}).blockers).toContain('PCM_STALE');
 });
 it('rejects unknown authority and fabricated missing PCM',()=>{
  const x=inspectRadioOutputBoundary();
  expect(x.canSimulatePresenter).toBe(false);
  expect(x.changeApplied).toBe(false);
  expect(x.fallback).toBe('AUTO_DJ');
 });
});
