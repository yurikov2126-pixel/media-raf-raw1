import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsStationResume as assess} from '../src/lib/mchsStationResumeEvidence.js';
const now=Date.parse('2026-11-03T11:00:00.000Z');
const eventId='training-1';
const workerReceipt={eventId,trialOnly:true,naturalCompletion:true,
 lastStopReason:'FILE_COMPLETED',active:false,repeats:3,completedRepeats:3,
 completedAt:new Date(now-5000).toISOString()};
const workerOverlay={active:false,output:'NORMAL_PROGRAM'};
const workerHealth={mode:'AUTO_DJ',lastError:null};
const agentReport={version:2,eventId,state:'COMPLETED',
 localNaturalCompletionObserved:true,processRunning:false,failureReason:null,
 completedRepeats:3,expectedRepeats:3,reportedAt:new Date(now-4000).toISOString()};
const agentAudio={playback:'PLAYING',source:'CENTRAL',lastPacketAgeMs:300,
 receivedAt:new Date(now-1000).toISOString()};
const good={eventId,workerReceipt,workerOverlay,workerHealth,agentReport,agentAudio,nowMs:now};
test('Worker and Agent both resume with fresh post-ALARM software evidence',()=>{
 const result=assess(good);
 assert.equal(result.bothSoftwareChannelsResumed,true);
 assert.equal(result.workerReturnedToProgram,true);
 assert.equal(result.agentReturnedToCentral,true);
 assert.equal(result.physicalAudibilityVerified,false);
 assert.equal(result.publicPlaybackAuthorized,false);
});
test('an unbound Worker status does not substitute for completion',()=>{
 const result=assess({...good,workerReceipt:null});
 assert.equal(result.bothSoftwareChannelsResumed,false);
 assert.ok(result.holds.includes('WORKER_COMPLETION_UNCONFIRMED'));
});
test('overlay still active or station not ready means return unconfirmed',()=>{
 for(const patch of [
  {workerOverlay:{...workerOverlay,active:true}},
  {workerOverlay:{active:false,output:'TRAINING'}},
  {workerHealth:{mode:'UNKNOWN',lastError:null}},
  {workerHealth:{mode:'AUTO_DJ',lastError:'decoder failed'}}
 ]){
  assert.equal(assess({...good,...patch}).bothSoftwareChannelsResumed,false);
 }
});
test('Agent stale, failed or local reserve is not central return evidence',()=>{
 for(const audio of [
  {...agentAudio,playback:'BUFFERING'},
  {...agentAudio,source:'LOCAL_RESERVE'},
  {...agentAudio,lastPacketAgeMs:17000},
  {...agentAudio,receivedAt:new Date(now-20000).toISOString()},
  {...agentAudio,receivedAt:new Date(now+100).toISOString()}
 ]){
  const result=assess({...good,agentAudio:audio});
  assert.equal(result.bothSoftwareChannelsResumed,false);
  assert.equal(result.workerReturnedToProgram,true);
 }
});
test('a report for another ALARM or an old v1 report cannot certify return',()=>{
 for(const patch of [{version:1},{eventId:'older'},
  {completedRepeats:1},{localNaturalCompletionObserved:false},
  {processRunning:true},{failureReason:'RuntimeError'}]){
  assert.equal(assess({...good,agentReport:{...agentReport,...patch}}).agentReturnedToCentral,false);
 }
});
test('last packet must be observed after the ALARM end',()=>{
 const result=assess({...good,agentAudio:{...agentAudio,
  receivedAt:new Date(now-5500).toISOString()}});
 assert.equal(result.bothSoftwareChannelsResumed,false);
 assert.ok(result.holds.includes('AGENT_AUDIO_NOT_FRESH_AFTER_ALARM'));
});
test('expired Worker record cannot be reused indefinitely',()=>{
 const result=assess({...good,nowMs:now+90000});
 assert.equal(result.bothSoftwareChannelsResumed,false);
 assert.ok(result.holds.includes('WORKER_COMPLETION_STALE'));
});
test('no evidence never certifies either channel or physical output',()=>{
 const result=assess({nowMs:now});
 assert.equal(result.workerReturnedToProgram,false);
 assert.equal(result.agentReturnedToCentral,false);
 assert.equal(result.bothSoftwareChannelsResumed,false);
 assert.equal(result.physicalAudibilityVerified,false);
});
test('schedule and live program sources remain acceptable when confirmed',()=>{
 for(const mode of ['SCHEDULED','LIVE','MANUAL_PLAYLIST','AUTO_PLAYLIST']){
  assert.equal(assess({...good,workerHealth:{mode,lastError:null}}).workerReturnedToProgram,true);
 }
});
