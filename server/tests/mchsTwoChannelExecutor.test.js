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

test('unresponsive Agent START times out and sends STOP to both channels',async()=>{
 const log=[];
 const slow={start:()=>new Promise(()=>{}),stop:async()=>{log.push('agent STOP');return {confirmed:false};}};
 const x=await runMchsTwoChannelExecution({event,authorization,worker:channel('worker',log),agent:slow,
  now:()=>now,startTimeoutMs:100});
 assert.equal(x.reason,'START_TIMEOUT');
 assert.equal(x.stopConfirmed,false);
 assert.equal(x.requiresOperatorReview,true);
 assert.ok(log.includes('worker:STOP'));assert.ok(log.includes('agent STOP'));
});
test('operator abort while START pending sends STOP to both channels',async()=>{
 const log=[];const ctl=new AbortController();
 const slow={start:()=>new Promise(()=>{}),stop:async()=>{log.push('agent STOP');}};
 setTimeout(()=>ctl.abort(),10);
 const x=await runMchsTwoChannelExecution({event,authorization,worker:channel('worker',log),agent:slow,
  now:()=>now,startTimeoutMs:2000,signal:ctl.signal});
 assert.equal(x.reason,'CANCELLED');
 assert.ok(log.includes('agent STOP'));assert.ok(log.includes('worker:STOP'));
});
