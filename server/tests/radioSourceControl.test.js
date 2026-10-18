import {describe,it,expect} from 'vitest';
import {DEFAULT_SOURCE_CONTROL,validateSourceControl,readSourceControl,resolveSourcePriority} from '../src/lib/radioSourceControl.js';
const now=Date.parse('2026-10-18T18:00:00Z');
describe('live-source station policy',()=>{
 it('gives approved schedule absolute priority',()=>{
  const settings={...DEFAULT_SOURCE_CONTROL,requestedSource:'LIVE',liveEnabled:true};
  expect(resolveSourcePriority({settings,scheduled:true,liveConnected:true,heartbeatAt:new Date(now).toISOString(),nowMs:now}).source).toBe('SCHEDULED');
 });
 it('accepts only fresh live heartbeat and configured opt-in',()=>{
  const settings={...DEFAULT_SOURCE_CONTROL,requestedSource:'LIVE',liveEnabled:true};
  expect(resolveSourcePriority({settings,liveConnected:true,heartbeatAt:new Date(now-1000).toISOString(),nowMs:now}).source).toBe('LIVE_READY');
  expect(resolveSourcePriority({settings,liveConnected:true,heartbeatAt:new Date(now-20000).toISOString(),nowMs:now,autoDjEnabled:true}).source).toBe('AUTO_DJ');
  expect(resolveSourcePriority({settings:{...settings,liveEnabled:false},liveConnected:true,heartbeatAt:new Date(now).toISOString(),nowMs:now,autoDjEnabled:true}).source).toBe('AUTO_DJ');
 });
 it('honors no-auto-return policy and never claims audible mic',()=>{
  const settings={...DEFAULT_SOURCE_CONTROL,requestedSource:'LIVE',liveEnabled:true,autoReturn:false};
  expect(resolveSourcePriority({settings,nowMs:now,autoDjEnabled:true}).source).toBe('SILENCE');
 });
 it('rejects malformed settings and loads legacy default safely',async()=>{
  expect(()=>validateSourceControl({...DEFAULT_SOURCE_CONTROL,heartbeatTimeoutSec:0})).toThrow();
  expect(()=>validateSourceControl({...DEFAULT_SOURCE_CONTROL,requestedSource:'PA'})).toThrow();
  expect((await readSourceControl({setting:{findUnique:async()=>null}})).requestedSource).toBe('AUTO_DJ');
 });
});
