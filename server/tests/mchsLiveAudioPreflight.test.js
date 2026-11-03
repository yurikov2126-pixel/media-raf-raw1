import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsLiveAudioPreflight as assess} from '../src/lib/mchsLiveAudioPreflight.js';

const now=Date.parse('2026-11-03T12:00:00Z');
const good={
 workerHealth:{mode:'AUTO_DJ',lastError:null},
 workerOverlay:{active:false,output:'NORMAL_PROGRAM'},
 agentAudio:{source:'CENTRAL',playback:'PLAYING',lastPacketAgeMs:500,
  receivedAt:new Date(now-1000).toISOString()},
 deviceBound:true,nowMs:now
};
test('fresh real-service telemetry observes a software chain but never authorizes ALARM',()=>{
 const r=assess(good);
 assert.equal(r.softwareChainObserved,true);
 assert.deepEqual(r.holds,[]);
 assert.equal(r.mayStartAlarm,false);
 assert.equal(r.physicalOutputIsolationVerified,false);
 assert.equal(r.publicPlaybackAuthorized,false);
});
test('missing Worker or active overlay prevents a positive preflight',()=>{
 for(const patch of [
  {workerHealth:null},
  {workerHealth:{mode:'UNKNOWN'}},
  {workerHealth:{mode:'AUTO_DJ',lastError:'decoder error'}},
  {workerOverlay:null},
  {workerOverlay:{active:true,output:'TRAINING'}}
 ]){
  const r=assess({...good,...patch});
  assert.equal(r.softwareChainObserved,false);
  assert.equal(r.mayStartAlarm,false);
 }
});
test('stale, future, or absent Agent observation fails closed',()=>{
 for(const audio of [
  null,
  {...good.agentAudio,receivedAt:new Date(now-30000).toISOString()},
  {...good.agentAudio,receivedAt:new Date(now+1000).toISOString()},
  {...good.agentAudio,lastPacketAgeMs:9000},
  {...good.agentAudio,source:'LOCAL_RESERVE'},
  {...good.agentAudio,playback:'BUFFERING'}
 ]){
  const r=assess({...good,agentAudio:audio});
  assert.equal(r.softwareChainObserved,false);
 }
});
test('unbound device never qualifies and empty observations never qualify',()=>{
 assert.ok(assess({...good,deviceBound:false}).holds.includes('AGENT_DEVICE_NOT_BOUND'));
 const r=assess({nowMs:now});
 assert.equal(r.softwareChainObserved,false);
 assert.equal(r.mayStartAlarm,false);
 assert.equal(r.physicalOutputIsolationVerified,false);
});
