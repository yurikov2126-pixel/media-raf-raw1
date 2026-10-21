import {describe,it,expect} from 'vitest';
import {RadioStationPcmClock} from '../src/lib/radioStationPcmClock.js';
describe('authoritative station PCM clock',()=>{
 it('uses immutable absolute schedule boundary and exact 48kHz frame accounting',()=>{
  const clock=new RadioStationPcmClock();
  clock.arm({sourceId:'a',startAtMs:10000,boundaryMs:20000});
  clock.emit(48000*4*8);
  const state=clock.snapshot(18000);
  expect(state.framesOut).toBe(384000);
  expect(state.driftMs).toBe(0);
  expect(state.boundaryInMs).toBe(2000);
  expect(clock.decision(18600,{sourceReady:true,targetReady:true,authority:true}).ok).toBe(true);
  expect(clock.decision(20000,{sourceReady:true,targetReady:true,authority:true}).reason).toBe('BOUNDARY_PASSED');
 });
 it('does not infer schedule readiness from decoder backlog',()=>{
  const clock=new RadioStationPcmClock();
  clock.arm({sourceId:'a',startAtMs:10000,boundaryMs:20000});
  clock.emit(48000*4*5);
  expect(clock.decision(18600,{sourceReady:true,targetReady:true,authority:true}).reason).toBe('PCM_DRIFT');
 });
 it('fails closed when target or authority changes',()=>{
  const clock=new RadioStationPcmClock();
  clock.arm({sourceId:'a',startAtMs:10000,boundaryMs:20000});
  clock.emit(48000*4*8.6);
  expect(clock.decision(18600,{sourceReady:true,targetReady:true,authority:false}).reason).toBe('NO_AUTHORITY');
  expect(clock.decision(18600,{sourceReady:true,targetReady:false,authority:true}).reason).toBe('TARGET_NOT_READY');
  expect(clock.decision(18600,{sourceReady:true,targetReady:true,authority:true,publicLive:true}).reason).toBe('PUBLIC_LIVE');
 });
 it('rejects partial frames and invalid boundaries',()=>{
  const clock=new RadioStationPcmClock();
  expect(()=>clock.arm({sourceId:'a',startAtMs:10,boundaryMs:10})).toThrow();
  clock.arm({sourceId:'a',startAtMs:0,boundaryMs:10000});
  expect(()=>clock.emit(3)).toThrow();
 });
});
