import {describe,it,expect} from 'vitest';
import {planHourlyTrackHandover as decide} from '../src/lib/radioHourlyHandover.js';
const base={enabled:true,source:'AUTO_DJ',atMs:100000,boundaryMs:100000,
 remainingMs:30000,thresholdSeconds:60,maxDelaySeconds:60,mode:'BALANCED',hasSignal:true};
describe('hourly sixty-second handover policy',()=>{
 it('completes a short track and interrupts a long one',()=>{
  expect(decide(base).action).toBe('FINISH_THEN_ANNOUNCE');
  expect(decide({...base,remainingMs:59000}).action).toBe('FINISH_THEN_ANNOUNCE');
  expect(decide({...base,remainingMs:60000}).action).toBe('FINISH_THEN_ANNOUNCE');
  expect(decide({...base,remainingMs:61000}).action).toBe('FADE_AND_ADVANCE');
  expect(decide({...base,remainingMs:180000}).action).toBe('FADE_AND_ADVANCE');
 });
 it('never overrides LIVE, a scheduled slot, missing audio or duplicate',()=>{
  expect(decide({...base,live:true}).reason).toBe('LIVE_PRIORITY');
  expect(decide({...base,scheduledSlotActive:true}).reason).toBe('SCHEDULE_AUTHORITY');
  expect(decide({...base,hasSignal:false}).reason).toBe('NO_READY_SIGNAL');
  expect(decide({...base,alreadyHandled:true}).reason).toBe('ALREADY_HANDLED');
 });
 it('does not act outside hour window or with unknown remaining duration',()=>{
  expect(decide({...base,atMs:99000}).reason).toBe('BEFORE_BOUNDARY');
  expect(decide({...base,atMs:161000}).reason).toBe('AFTER_DEADLINE');
  expect(decide({...base,remainingMs:NaN}).reason).toBe('INVALID_CLOCK');
 });
 it('enforces strict and soft policies without overlap',()=>{
  expect(decide({...base,mode:'STRICT'}).action).toBe('FADE_AND_ADVANCE');
  expect(decide({...base,mode:'SOFT',remainingMs:61000}).reason).toBe('SOFT_DEADLINE');
  expect(decide({...base,mode:'SOFT',remainingMs:20000}).action).toBe('FINISH_THEN_ANNOUNCE');
  expect(decide({...base,enabled:false}).reason).toBe('DISABLED');
 });
});
