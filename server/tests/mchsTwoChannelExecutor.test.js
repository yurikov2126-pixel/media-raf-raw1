import test from 'node:test';import assert from 'node:assert/strict';
import {runMchsTwoChannelExecution} from '../src/lib/mchsTwoChannelExecutor.js';
const now=Date.parse('2026-11-02T18:00:00Z');
const event={id:'evt',eventType:'MISSILE_DANGER',assetId:'alarm',repeats:2,occurredAt:'2026-11-02T17:59:50Z'};
const authorization={approved:true,mode:'ISOLATED_TRIAL',publicStreamAllowed:false,amplifierAllowed:false};
function channel(name,log,broken=false){
 return {async start(spec){log.push(name+':START');if(broken)throw Error('broken');
  return {eventId:spec.eventId,eventType:spec.eventType,action:'START',confirmed:true,playbackState:'ACTIVE',confirmedAt:new Date(now).toISOString()};},
 async stop(spec){log.push(name+':STOP');return {eventId:spec.eventId,eventType:spec.eventType,action:'STOP',confirmed:true,playbackState:'STOPPED',confirmedAt:new Date(now).toISOString()};}};
}
test('both adapters START then STOP and return confirmed state',async()=>{
 const log=[];const x=await runMchsTwoChannelExecution({event,authorization,worker:channel('worker',log),agent:channel('agent',log),now:()=>now});
 assert.equal(x.ok,true);assert.equal(x.automaticBroadcastEnabled,false);
 assert.equal(log.length,4);assert.equal(log.includes('agent:STOP'),true);
});
test('failed Agent START still attempts STOP on both',async()=>{
 const log=[];const x=await runMchsTwoChannelExecution({event,authorization,worker:channel('worker',log),agent:channel('agent',log,true),now:()=>now});
 assert.equal(x.ok,false);assert.equal(x.reason,'START_NOT_CONFIRMED');
 assert.equal(log.includes('worker:STOP'),true);assert.equal(log.includes('agent:STOP'),true);
});
test('public authorization is rejected before adapters',async()=>{
 const x=await runMchsTwoChannelExecution({event,authorization:{...authorization,publicStreamAllowed:true},
  worker:{},agent:{},now:()=>now});
 assert.equal(x.reason,'TRIAL_AUTHORIZATION_REQUIRED');
});
test('stale event is rejected',async()=>{
 const x=await runMchsTwoChannelExecution({event:{...event,occurredAt:'2026-11-02T17:50:00Z'},
  authorization,worker:{},agent:{},now:()=>now});
 assert.equal(x.reason,'EXPIRED_EVENT');
});
