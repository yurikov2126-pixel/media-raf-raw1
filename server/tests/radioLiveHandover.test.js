import {describe,it,expect} from 'vitest';
import {planSourceHandover} from '../src/lib/radioLiveHandover.js';
const now=Date.parse('2026-10-18T20:00:00Z');
const settings={requestedSource:'LIVE',liveEnabled:true,autoReturn:true,heartbeatTimeoutSec:15};
const base={settings,nowMs:now,autoDjEnabled:true,currentSource:'AUTO_DJ'};
describe('live handover failure-safe simulation',()=>{
 it('never promotes socket presence without decoded PCM',()=>{
  const x=planSourceHandover({...base,liveConnected:true,heartbeatAt:new Date(now).toISOString()});
  expect(x.target).toBe('AUTO_DJ');expect(x.reason).toBe('PCM_NOT_READY');
  expect(x.activeSwitching).toBe(false);
 });
 it('requires fresh connection and actual PCM samples for candidate',()=>{
  const x=planSourceHandover({...base,liveConnected:true,heartbeatAt:new Date(now-1000).toISOString(),pcmSamplesReceived:true});
  expect(x.target).toBe('LIVE_CANDIDATE');
  expect(x.transition).toBe('PENDING');
  expect(planSourceHandover({...base,liveConnected:true,heartbeatAt:new Date(now-16000).toISOString(),pcmSamplesReceived:true}).target).toBe('AUTO_DJ');
 });
 it('never supersedes an active approved schedule',()=>{
  const x=planSourceHandover({...base,scheduled:true,liveConnected:true,heartbeatAt:new Date(now).toISOString(),pcmSamplesReceived:true});
  expect(x.target).toBe('SCHEDULED');
 });
 it('respects no-auto-return setting with silence on failure',()=>{
  const x=planSourceHandover({...base,settings:{...settings,autoReturn:false},liveConnected:false});
  expect(x.target).toBe('SILENCE');
 });
 it('reports upcoming schedule boundary without claiming live audio',()=>{
  const x=planSourceHandover({...base,scheduledAt:new Date(now+5000).toISOString()});
  expect(x.timeToScheduleMs).toBe(5000);expect(x.activeSwitching).toBe(false);
 });
});
