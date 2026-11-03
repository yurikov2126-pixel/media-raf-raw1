import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceMchsDeviceCommand as advance} from '../src/lib/mchsDeviceCommandLedger.js';
const t=Date.parse('2026-11-03T12:00:00Z');
const event={type:'QUEUE_STOP',eventId:'event-1',eventType:'MISSILE_DANGER'};
test('STOP is queued, delivered and acknowledged with exact event binding',()=>{
 const first=advance({},event,{nowMs:t});
 assert.equal(first.ok,true);
 const sent=advance(first.state,{type:'DELIVER'},{nowMs:t+100});
 assert.equal(sent.command.action,'STOP');
 const rejected=advance(first.state,{type:'RECEIPT',receipt:{
  sequence:1,eventId:'other',eventType:'MISSILE_DANGER',action:'STOP',
  confirmed:true,playbackState:'STOPPED',localTrialStoppedConfirmed:true,confirmedAt:new Date(t+200).toISOString()}},{nowMs:t+200});
 assert.equal(rejected.ok,false);
 const accepted=advance(first.state,{type:'RECEIPT',receipt:{
  sequence:1,eventId:'event-1',eventType:'MISSILE_DANGER',action:'STOP',
  confirmed:true,playbackState:'STOPPED',localTrialStoppedConfirmed:true,confirmedAt:new Date(t+200).toISOString()}},{nowMs:t+200});
 assert.equal(accepted.ok,true);assert.equal(accepted.state.pending,null);
});
test('HALT cancels pending START while preserving STOP priority',()=>{
 const start={version:1,sequence:1,action:'START',eventId:'event-1'};
 const halted=advance({sequence:1,pending:start,halted:false},{type:'HALT'},{nowMs:t});
 assert.equal(halted.state.pending,null);
 const queued=advance(halted.state,event,{nowMs:t});
 assert.equal(queued.state.pending.action,'STOP');
});
test('outdated commands expire and automatic START is denied',()=>{
 const queued=advance({},event,{nowMs:t});
 assert.equal(advance(queued.state,{type:'DELIVER'},{nowMs:t+15001}).command,null);
 assert.equal(advance({}, {type:'QUEUE_START',eventId:'event-1'}, {nowMs:t}).ok,false);
});

test('repeated STOP delivery keeps one sequence and its receipt valid',()=>{
 const first=advance({},event,{nowMs:t});
 const retry=advance(first.state,event,{nowMs:t+500});
 assert.equal(retry.ok,true);
 assert.equal(retry.alreadyQueued,true);
 assert.equal(retry.state.sequence,first.state.sequence);
 const receipt={sequence:first.state.sequence,eventId:event.eventId,
  eventType:event.eventType,action:'STOP',confirmed:true,
  playbackState:'STOPPED',localTrialStoppedConfirmed:true,
  confirmedAt:new Date(t+600).toISOString()};
 const ack=advance(retry.state,{type:'RECEIPT',receipt},{nowMs:t+600});
 assert.equal(ack.ok,true);
 assert.equal(ack.state.pending,null);
});
test('expired STOP may be requeued, stale receipt cannot confirm newer STOP',()=>{
 const first=advance({},event,{nowMs:t});
 const second=advance(first.state,event,{nowMs:t+16000});
 assert.equal(second.state.sequence,2);
 const stale={sequence:1,eventId:event.eventId,eventType:event.eventType,
  action:'STOP',confirmed:true,playbackState:'STOPPED',
  localTrialStoppedConfirmed:true,confirmedAt:new Date(t+16001).toISOString()};
 assert.equal(advance(second.state,{type:'RECEIPT',receipt:stale},
  {nowMs:t+16001}).reason,'COMMAND_RECEIPT_MISMATCH');
});

test('unacknowledged STOP for one event cannot be silently overwritten by another',()=>{
 const first=advance({},event,{nowMs:t});
 const second=advance(first.state,{type:'QUEUE_STOP',eventId:'different',
  eventType:'MISSILE_ALL_CLEAR'},{nowMs:t+1000});
 assert.equal(second.ok,false);
 assert.equal(second.reason,'PRIOR_STOP_NOT_ACKNOWLEDGED');
 assert.equal(second.state.pending.eventId,event.eventId);
});

test('isolated START can be staged only with explicit evidence and no HALT',()=>{
 const a={mode:'ISOLATED_TRIAL',approved:true,publicStreamAllowed:false,
  amplifierAllowed:false,outputIsolationVerified:true};
 const input={type:'QUEUE_START',eventId:'evt-safe',eventType:'MISSILE_DANGER',
  assetId:'alarm1',sha256:'a'.repeat(64),repeats:2,
  sourceOfficiallyVerified:true,authorization:a};
 assert.equal(advance({},input,{nowMs:t}).reason,'HALT_ACTIVE');
 assert.equal(advance({halted:false}, {...input,authorization:{...a,outputIsolationVerified:false}},
  {nowMs:t}).reason,'ISOLATION_NOT_VERIFIED');
 const staged=advance({halted:false},input,{nowMs:t});
 assert.equal(staged.ok,true);
 assert.equal(staged.state.pending.action,'START');
 assert.equal(staged.state.pending.trialOnly,true);
 assert.equal(staged.state.pending.expiresAt,new Date(t+10000).toISOString());
 assert.equal(advance(staged.state,input,{nowMs:t+1}).reason,'COMMAND_ALREADY_PENDING');
 const cancelled=advance(staged.state,{type:'HALT'},{nowMs:t+2});
 assert.equal(cancelled.state.pending,null);
 assert.equal(cancelled.state.halted,true);
});
test('all-clear START with multiple repeats is rejected even during isolated trial',()=>{
 const attempt=advance({halted:false},{type:'QUEUE_START',eventId:'evt',
  eventType:'MISSILE_ALL_CLEAR',assetId:'alarm',sha256:'b'.repeat(64),repeats:2,
  sourceOfficiallyVerified:true,authorization:{mode:'ISOLATED_TRIAL',approved:true,
  publicStreamAllowed:false,amplifierAllowed:false,outputIsolationVerified:true}},{nowMs:t});
 assert.equal(attempt.reason,'INVALID_EVENT_AUDIO');
});
