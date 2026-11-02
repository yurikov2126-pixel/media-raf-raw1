import test from 'node:test';
import assert from 'node:assert/strict';
import {createMchsWorkerAlarmAdapter} from '../src/lib/mchsWorkerAlarmAdapter.js';
import {runMchsTwoChannelExecution} from '../src/lib/mchsTwoChannelExecutor.js';

const instant=Date.parse('2026-11-03T12:00:00Z');
const event={id:'e1',eventType:'MISSILE_DANGER',assetId:'a1',repeats:2,
 occurredAt:new Date(instant-1000).toISOString()};
const authorization={approved:true,mode:'ISOLATED_TRIAL',
 publicStreamAllowed:false,amplifierAllowed:false};

test('Worker START returns immediately, completion separately counts repeats, STOP confirms',async()=>{
 let active=false,starts=0,polls=0;
 const request=async(action,assetId)=>{
  if(action==='START'){active=true;starts++;polls=0;
   assert.equal(assetId,'a1');return {httpStatus:200,data:{ok:true}};}
  if(action==='STOP'){active=false;return {httpStatus:200,data:{ok:true}};}
  polls++;
  const observation={httpStatus:200,data:{active,assetId:active?'a1':null,
   lastStopReason:'FILE_COMPLETED'}};
  if(polls>1)active=false;
  return observation;
 };
 const worker=createMchsWorkerAlarmAdapter({
  request,isolatedOutputVerified:true,sleep:async()=>{},pollMs:1});
 const agent={
  async start(spec){return {confirmed:true,eventId:spec.eventId,eventType:spec.eventType,
   action:'START',playbackState:'ACTIVE',confirmedAt:new Date(instant).toISOString()};},
  async waitUntilCompleted(){return {completed:true};},
  async stop(spec){return {confirmed:true,eventId:spec.eventId,eventType:spec.eventType,
   action:'STOP',playbackState:'STOPPED',confirmedAt:new Date(instant).toISOString()};}
 };
 const result=await runMchsTwoChannelExecution({
  event,authorization,worker,agent,now:()=>instant,completionTimeoutMs:1000});
 assert.equal(result.ok,true,result.reason);
 assert.equal(starts,2);
});
test('without genuine output isolation START never calls real Worker',async()=>{
 let calls=0;
 const worker=createMchsWorkerAlarmAdapter({request:async()=>{calls++;}});
 const result=await worker.start({eventId:'e1',eventType:'MISSILE_DANGER',
  assetId:'a1',repeats:2,publicStreamAllowed:false,amplifierAllowed:false});
 assert.equal(result.confirmed,false);
 assert.equal(result.reason,'OUTPUT_ISOLATION_NOT_VERIFIED');
 assert.equal(calls,0);
});
