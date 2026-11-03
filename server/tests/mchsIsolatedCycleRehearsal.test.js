import test from 'node:test';
import assert from 'node:assert/strict';
import {rehearseMchsIsolatedCycle as rehearse} from '../src/lib/mchsIsolatedCycleRehearsal.js';
const now=Date.parse('2026-11-03T12:00:00.000Z');
const danger={id:'danger-1',eventType:'MISSILE_DANGER',assetId:'audio-danger',repeats:4,
 occurredAt:new Date(now-1000).toISOString()};
const allClear={id:'clear-1',eventType:'MISSILE_ALL_CLEAR',assetId:'audio-clear',repeats:1,
 occurredAt:new Date(now-1000).toISOString()};
const authorization={approved:true,mode:'ISOLATED_TRIAL',outputIsolationVerified:true,
 publicStreamAllowed:false,amplifierAllowed:false};
function mockChannel(name,log,{failStart=false,failFinish=false}={}){
 return {
  async start(spec){
   log.push(name+':START:'+spec.eventId);
   if(failStart)throw Error('DEVICE_DISCONNECTED');
   return {eventId:spec.eventId,eventType:spec.eventType,action:'START',
    confirmed:true,playbackState:'ACTIVE',confirmedAt:new Date(now).toISOString()};
  },
  async waitUntilCompleted(spec){
   log.push(name+':FINISH:'+spec.eventId);
   return failFinish?{completed:false,reason:'PLAYER_FAILED'}:
    {completed:true,eventId:spec.eventId,repeats:spec.repeats,reason:'FILE_COMPLETED'};
  },
  async stop(spec){
   log.push(name+':STOP:'+spec.eventId);
   return {eventId:spec.eventId,eventType:spec.eventType,action:'STOP',
    confirmed:true,playbackState:'STOPPED',confirmedAt:new Date(now).toISOString()};
  }
 };
}
function evidence(event){
 return {
  workerReceipt:{eventId:event.id,trialOnly:true,naturalCompletion:true,
   lastStopReason:'FILE_COMPLETED',active:false,repeats:event.repeats,
   completedRepeats:event.repeats,completedAt:new Date(now-500).toISOString()},
  workerOverlay:{active:false,output:'NORMAL_PROGRAM'},
  workerHealth:{mode:'AUTO_DJ',lastError:null},
  agentReport:{version:2,eventId:event.id,state:'COMPLETED',
   localNaturalCompletionObserved:true,processRunning:false,failureReason:null,
   completedRepeats:event.repeats,expectedRepeats:event.repeats,
   reportedAt:new Date(now-300).toISOString()},
  agentAudio:{playback:'PLAYING',source:'CENTRAL',lastPacketAgeMs:200,
   receivedAt:new Date(now-100).toISOString()}
 };
}
function setup({workerOptions={},agentOptions={},readResumeEvidence=evidence}={}){
 const log=[];
 return {log,options:{danger,allClear,authorization,now:()=>now,
  worker:mockChannel('WORKER',log,workerOptions),
  agent:mockChannel('AGENT',log,agentOptions),readResumeEvidence}};
}
test('danger four full repeats then all-clear one, both channels naturally finish and return',async()=>{
 const {log,options}=setup();
 const result=await rehearse(options);
 assert.equal(result.ok,true);
 assert.equal(result.normalProgramSoftwareVerified,true);
 assert.equal(result.manualStopRequired,false);
 assert.equal(result.physicalAudibilityVerified,false);
 assert.equal(result.publicPlaybackAuthorized,false);
 assert.deepEqual(result.results.map(x=>x.stage),['DANGER','ALL_CLEAR']);
 assert.deepEqual(result.results.map(x=>x.execution.completionEvidence.worker.repeats),[4,1]);
 assert.equal(log.filter(x=>x.includes(':STOP:')).length,0);
 assert.equal(log.filter(x=>x.includes(':START:')).length,4);
 assert.equal(log.filter(x=>x.includes(':FINISH:')).length,4);
});
test('no transport action if physical trial isolation is not established',async()=>{
 const {log,options}=setup();
 const result=await rehearse({...options,authorization:{...authorization,outputIsolationVerified:false}});
 assert.equal(result.reason,'ISOLATED_REHEARSAL_REQUIRED');
 assert.deepEqual(log,[]);
});
test('public output is forbidden regardless of supplied adapters',async()=>{
 const {log,options}=setup();
 const result=await rehearse({...options,authorization:{...authorization,publicStreamAllowed:true}});
 assert.equal(result.ok,false);
 assert.deepEqual(log,[]);
});
test('Agent start failure invokes recovery and never plays all-clear',async()=>{
 const {log,options}=setup({agentOptions:{failStart:true}});
 const result=await rehearse(options);
 assert.equal(result.reason,'AUDIO_EXECUTION_FAILED');
 assert.equal(result.stage,'DANGER');
 assert.ok(log.includes('WORKER:STOP:danger-1'));
 assert.ok(log.includes('AGENT:STOP:danger-1'));
 assert.equal(log.some(x=>x.includes('clear-1')),false);
});
test('Agent completion failure does not advance to all-clear',async()=>{
 const {log,options}=setup({agentOptions:{failFinish:true}});
 const result=await rehearse(options);
 assert.equal(result.ok,false);
 assert.equal(result.executionReason,'COMPLETION_NOT_CONFIRMED');
 assert.ok(log.includes('WORKER:STOP:danger-1'));
 assert.equal(log.some(x=>x.includes('clear-1')),false);
});
test('central packet before Agent finishes must not count as station return',async()=>{
 const {log,options}=setup({readResumeEvidence:event=>({
  ...evidence(event),agentAudio:{...evidence(event).agentAudio,
   receivedAt:new Date(now-400).toISOString()}
 })});
 const result=await rehearse(options);
 assert.equal(result.reason,'PROGRAM_RETURN_UNCONFIRMED');
 assert.ok(result.holds.includes('AGENT_AUDIO_NOT_FRESH_AFTER_ALARM'));
 assert.equal(log.some(x=>x.includes('clear-1')),false);
});
test('missing station telemetry blocks progress without claiming to have stopped anything',async()=>{
 const {log,options}=setup({readResumeEvidence:()=>null});
 const result=await rehearse(options);
 assert.equal(result.reason,'PROGRAM_RETURN_UNCONFIRMED');
 assert.equal(result.results.length,1);
 assert.equal(log.filter(x=>x.includes(':STOP:')).length,0);
});
test('read-only evidence service outage fails closed',async()=>{
 const {log,options}=setup({readResumeEvidence:async()=>{throw Error('NETWORK');}});
 const result=await rehearse(options);
 assert.equal(result.reason,'RESUME_EVIDENCE_UNAVAILABLE');
 assert.equal(log.some(x=>x.includes('clear-1')),false);
});
test('wrong event ID on completion cannot be reused',async()=>{
 const {log,options}=setup({readResumeEvidence:event=>{
  const data=evidence(event);
  data.agentReport.eventId='old-event';
  return data;
 }});
 const result=await rehearse(options);
 assert.equal(result.reason,'PROGRAM_RETURN_UNCONFIRMED');
 assert.ok(result.holds.includes('AGENT_ALARM_COMPLETION_UNCONFIRMED'));
 assert.equal(log.some(x=>x.includes('clear-1')),false);
});
test('rehearsal cannot treat the same event or same audio asset as two stages',async()=>{
 const {log,options}=setup();
 for(const change of [{allClear:{...allClear,id:danger.id}},
   {allClear:{...allClear,assetId:danger.assetId}},
   {allClear:{...allClear,repeats:2}}]){
  const result=await rehearse({...options,...change});
  assert.equal(result.reason,'INVALID_REHEARSAL_SEQUENCE');
 }
 assert.deepEqual(log,[]);
});
