import {describe,it,expect} from 'vitest';
import {assessEmergencyAudioTestReadiness as assess} from '../src/lib/mchsAudioTestReadiness.js';
const now=Date.parse('2026-10-29T12:00:00Z');
const slot={id:'slot-1',playlistId:'playlist',startAt:new Date(now-30000).toISOString(),
 endAt:new Date(now+30000).toISOString(),playlist:{name:'Test',items:[{asset:{id:'asset',name:'Track',durationMs:60000}}]}};
const base={workerReachable:true,workerSource:'SCHEDULE',nowMs:now,slots:[slot]};
describe('MCHS emergency isolated-audio readiness',()=>{
 it('fails closed without verified hardware and supervision',()=>{
  const result=assess(base);
  expect(result.readyForIsolatedAudioTest).toBe(false);
  expect(result.unmet).toContain('ISOLATION');
  expect(result.unmet).toContain('STOP');
  expect(result.unmet).toContain('ROLLBACK');
  expect(result.realAudioTestStarted).toBe(false);
  expect(result.automaticMchsEnabled).toBe(false);
 });
 it('requires a valid current schedule for scheduled source',()=>{
  const result=assess({...base,nowMs:now+90000});
  expect(result.unmet).toContain('RESUME_PLAN');
 });
 it('requires separate live authorization evidence',()=>{
  expect(assess({...base,workerSource:'LIVE'}).unmet).toContain('RESUME_PLAN');
 });
 it('reports ready only when each safety gate has independent evidence',()=>{
  const result=assess({...base,testAudioValidated:true,isolatedOutputConfirmed:true,
   stopControlTested:true,rollbackTested:true,operatorPresent:true});
  expect(result.readyForIsolatedAudioTest).toBe(true);
  expect(result.playbackChanged).toBe(false);
 });
 it('does not call worker or execute effects',()=>expect(assess({}).playbackChanged).toBe(false));
});