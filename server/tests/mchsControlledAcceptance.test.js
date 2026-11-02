import test from 'node:test';
import assert from 'node:assert/strict';
import {executeMchsControlledAcceptance} from '../src/lib/mchsControlledAcceptance.js';
const at=Date.parse('2026-11-03T12:00:00Z');
const event={id:'evt-1',sourceEventId:'android-1',source:'MCHS_ANDROID',
 verified:true,region:'Тульская область',title:'Ракетная опасность',body:'',
 occurredAt:new Date(at-1000).toISOString()};
const rules={MISSILE_DANGER:{mode:'REVIEW',audioAssetId:'alarm',repeats:2}};
const args={event,rules,checkpoint:{state:'CLEAR'},sourceOfficiallyVerified:true,
 operatorHold:false,authorization:{approved:true,mode:'ISOLATED_TRIAL',
 publicStreamAllowed:false,amplifierAllowed:false},now:()=>at};
test('authentic Android alert is denied if completion-capable Agent missing',async()=>{
 const result=await executeMchsControlledAcceptance({...args,
  worker:{start(){},stop(){},waitUntilCompleted(){}},agent:{start(){},stop(){}}});
 assert.equal(result.reason,'INCOMPLETE_CHANNEL_TRANSPORT');
 assert.equal(result.executionEnabled,false);
});
test('operator hold, wrong region, unverified source and duplicate are denied before sound',async()=>{
 for(const patch of [{operatorHold:true},{sourceOfficiallyVerified:false},
 {event:{...event,region:'Московская область'}},{seenIds:new Set(['android-1'])}]){
  const result=await executeMchsControlledAcceptance({...args,...patch});
  assert.equal(result.ok,false);assert.equal(result.executionEnabled,false);
 }
});
test('public output authorization cannot be used for controlled acceptance',async()=>{
 const result=await executeMchsControlledAcceptance({...args,
  authorization:{...args.authorization,publicStreamAllowed:true}});
 assert.equal(result.reason,'TRIAL_AUTHORIZATION_REQUIRED');
});
test('invalid checkpoint state is rejected before playing audio',async()=>{
 const result=await executeMchsControlledAcceptance({...args,checkpoint:{state:'INVALID'}});
 assert.equal(result.reason,'UNKNOWN_STATE');
});

test('accepted event completes through both channels and advances checkpoint only after verified STOP',async()=>{
 const log=[];
 const channel=name=>({
  async start(spec){log.push(name+':start');return {eventId:spec.eventId,eventType:spec.eventType,
   action:'START',confirmed:true,playbackState:'ACTIVE',confirmedAt:new Date(at).toISOString()};},
  async waitUntilCompleted(){log.push(name+':complete');return {completed:true};},
  async stop(spec){log.push(name+':stop');return {eventId:spec.eventId,eventType:spec.eventType,
   action:'STOP',confirmed:true,playbackState:'STOPPED',confirmedAt:new Date(at).toISOString()};}
 });
 const result=await executeMchsControlledAcceptance({...args,
  worker:channel('worker'),agent:channel('agent')});
 assert.equal(result.ok,true);
 assert.equal(result.proposedCheckpoint.state,'DANGER');
 assert.equal(result.proposedCheckpoint.lastSourceEventId,'android-1');
 assert.equal(result.executionEnabled,false);
 assert.equal(log.length,6);
});
