import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsAgentTrialStart as assess} from '../src/lib/mchsAgentTrialStartPreflight.js';

const now=Date.parse('2026-11-04T12:00:00Z');
const event={id:'event_1',source:'MCHS_ANDROID',verified:true,
 title:'Ракетная опасность',body:'',occurredAt:new Date(now-1000).toISOString()};
const request={eventType:'MISSILE_DANGER',assetId:'local_training_wav',
 sha256:'a'.repeat(64),repeats:3};
const base={event,request,deviceBound:true,trialEnabled:true,
 operatorIsolationConfirmed:true,nowMs:now};

test('preflight is read-only and never authorizes public or PA playback',()=>{
 const result=assess(base);
 assert.equal(result.ready,true);
 assert.equal(result.eventId,event.id);
 assert.equal(result.publicPlaybackAuthorized,false);
 assert.equal(result.physicalPaVerified,false);
 assert.equal(result.sha256,request.sha256);
});

test('without bound device, trial gate, or operator physical isolation attestation, deny',()=>{
 for(const patch of [{deviceBound:false},{trialEnabled:false},
  {operatorIsolationConfirmed:false}]){
  const result=assess({...base,...patch});
  assert.equal(result.ready,false);
  assert.equal(result.publicPlaybackAuthorized,false);
 }
});

test('reject fabricated, unverified, future, and old source events',()=>{
 for(const patch of [
  {event:{...event,verified:false}},
  {event:{...event,source:'MANUAL'}},
  {event:{...event,occurredAt:new Date(now+1000).toISOString()}},
  {event:{...event,occurredAt:new Date(now-121000).toISOString()}},
  {event:{...event,id:'illegal/event'}}]){
  assert.equal(assess({...base,...patch}).ready,false);
 }
});

test('event type and local WAV digest must match allowlisted form',()=>{
 for(const patch of [
  {request:{...request,eventType:'MISSILE_ALL_CLEAR'}},
  {request:{...request,sha256:'bad'}},
  {request:{...request,assetId:'../../not-local'}},
  {request:{...request,repeats:6}}
 ]){
  assert.equal(assess({...base,...patch}).ready,false);
 }
});

test('all-clear accepts exactly one repeat and rejects multiple',()=>{
 const clear={...event,title:'Отбой ракетной опасности'};
 const ok=assess({...base,event:clear,request:{...request,eventType:'MISSILE_ALL_CLEAR',repeats:1}});
 assert.equal(ok.ready,true);
 assert.equal(assess({...base,event:clear,request:{...request,
  eventType:'MISSILE_ALL_CLEAR',repeats:2}}).ready,false);
});
