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
 const log=[];const ctl=new globalThis.AbortController();
 const slow={start:()=>new Promise(()=>{}),stop:async()=>{log.push('agent STOP');}};
 setTimeout(()=>ctl.abort(),10);
 const x=await runMchsTwoChannelExecution({event,authorization,worker:channel('worker',log),agent:slow,
  now:()=>now,startTimeoutMs:2000,signal:ctl.signal});
 assert.equal(x.reason,'CANCELLED');
 assert.ok(log.includes('agent STOP'));assert.ok(log.includes('worker:STOP'));
});

test('hanging Agent STOP is bounded and cannot be reported as verified',async()=>{
 const log=[];
 const hanging={start:async spec=>({
  eventId:spec.eventId,eventType:spec.eventType,action:'START',
  confirmed:true,playbackState:'ACTIVE',confirmedAt:new Date(now).toISOString()}),
  stop:()=>{log.push('agent STOP called');return new Promise(()=>{});}};
 const result=await runMchsTwoChannelExecution({
  event,authorization,worker:channel('worker',log),agent:hanging,
  now:()=>now,stopTimeoutMs:100});
 assert.equal(result.ok,false);
 assert.equal(result.reason,'STOP_NOT_CONFIRMED');
 assert.ok(result.stopEvidence.holds.some(x=>x.includes('AGENT')));
 assert.ok(log.includes('worker:STOP'));
 assert.ok(log.includes('agent STOP called'));
});
test('invalid STOP timeout prevents any channel action',async()=>{
 const log=[];
 const result=await runMchsTwoChannelExecution({
  event,authorization,worker:channel('worker',log),agent:channel('agent',log),
  now:()=>now,stopTimeoutMs:0});
 assert.equal(result.reason,'INVALID_STOP_TIMEOUT');
 assert.equal(log.length,0);
});

test('late START after timeout triggers second compensating STOP',async()=>{
 const log=[];let release;
 const late={start:()=>new Promise(resolve=>{release=resolve;}),stop:async()=>{log.push('agent STOP');}};
 let notify;const lateStop=new Promise(resolve=>{notify=resolve;});
 const result=await runMchsTwoChannelExecution({event,authorization,
  worker:channel('worker',log),agent:late,now:()=>now,startTimeoutMs:100,
  onLateStop:notify});
 assert.equal(result.reason,'START_TIMEOUT');
 assert.equal(log.filter(s=>s==='agent STOP').length,1);
 release({confirmed:true});
 const after=await lateStop;
 assert.equal(after.reason,'LATE_START_AFTER_CANCEL');
 assert.equal(log.filter(s=>s==='agent STOP').length,2);
 assert.equal(result.automaticBroadcastEnabled,false);
});
