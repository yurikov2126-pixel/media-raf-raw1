import {describe,it,expect} from 'vitest';
import {hourBoundary,nextHourlyBoundary,planHourlySignal} from '../src/lib/radioHourlySignalPlanner.js';
const settings={enabled:true,mode:'BALANCED',thresholdSeconds:60,maxDelaySeconds:60,fadeMs:1500,hourAssetIds:Array(24).fill('signal')};
const at=Date.parse('2026-10-23T12:00:00.000Z'); // 15:00 MSK
describe('hourly signal shadow planner',()=>{
 it('maps UTC boundary to Moscow hour and avoids duplicates',()=>{
  expect(hourBoundary(at+2000)).toBe(at);
  expect(nextHourlyBoundary(at)).toBe(at+3600000);
  expect(planHourlySignal({settings,nowMs:at,mode:'AUTO_DJ',remainingMs:180000}).action).toBe('ANNOUNCE');
  expect(planHourlySignal({settings,nowMs:at,mode:'AUTO_DJ',remainingMs:180000,activeHourKeys:[new Date(at).toISOString()]}).reason).toBe('ALREADY_HANDLED');
 });
 it('allows a short song to finish within the one-minute grace',()=>{
  expect(planHourlySignal({settings,nowMs:at,mode:'SCHEDULED',remainingMs:30000}).action).toBe('WAIT_EOF');
  expect(planHourlySignal({settings,nowMs:at,mode:'SCHEDULED',remainingMs:61000}).reason).toBe('INTERRUPT_LONG_TRACK');
 });
 it('does not interrupt public LIVE or act with unknown duration',()=>{
  expect(planHourlySignal({settings,nowMs:at,mode:'LIVE',remainingMs:120000}).reason).toBe('LIVE_PRIORITY');
  expect(planHourlySignal({settings,nowMs:at,mode:'AUTO_DJ',remainingMs:null}).reason).toBe('UNKNOWN_TRACK_REMAINDER');
 });
 it('handles late, missing, disabled and soft signals safely',()=>{
  expect(planHourlySignal({settings,nowMs:at+61000,mode:'AUTO_DJ',remainingMs:10000}).reason).toBe('TOO_LATE');
  expect(planHourlySignal({settings:{...settings,hourAssetIds:Array(24).fill(null)},nowMs:at,mode:'AUTO_DJ',remainingMs:10000}).reason).toBe('MISSING_AUDIO');
  expect(planHourlySignal({settings:{...settings,enabled:false},nowMs:at,mode:'AUTO_DJ',remainingMs:10000}).action).toBe('DISABLED');
  expect(planHourlySignal({settings:{...settings,mode:'SOFT'},nowMs:at,mode:'AUTO_DJ',remainingMs:180000}).action).toBe('SKIP');
 });
});
