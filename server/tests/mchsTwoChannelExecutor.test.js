import test from 'node:test';import assert from 'node:assert/strict';
import {runMchsTwoChannelExecution} from '../src/lib/mchsTwoChannelExecutor.js';
const now=Date.parse('2026-11-02T18:00:00Z');
const event={id:'evt',eventType:'MISSILE_DANGER',assetId:'alarm',repeats:2,occurredAt:'2026-11-02T17:59:50Z'};
const authorization={approved:true,mode:'ISOLATED_TRIAL',publicStreamAllowed:false,amplifierAllowed:false};
function channel(name,log,broken=false){
 return {async waitUntilCompleted(){log.push(name+':COMPLETE');return {completed:true,eventId:event.id,repeats:event.repeats,reason:'FILE_COMPLETED'};},async start(spec){log.push(name+':START');if(broken)throw Error('broken');
  return {eventId:spec.eventId,eventType:spec.eventType,action:'START',confirmed:true,playbackState:'ACTIVE',confirmedAt:new Date(now).toISOString()};},
 async stop(spec){log.push(name+':STOP');return {eventId:spec.eventId,eventType:spec.eventType,action:'STOP',confirmed:true,playbackState:'STOPPED',confirmedAt:new Date(now).toISOString()};}};
}
test('both adapters naturally complete: no STOP in the normal path',async()=>{
 const log=[];const x=await runMchsTwoChannelExecution({event,authorization,
  worker:channel('worker',log),agent:channel('agent',log),now:()=>now});
 assert.equal(x.ok,true);assert.equal(x.reason,'NATURAL_COMPLETION_CONFIRMED');
 assert.equal(x.automaticBroadcastEnabled,false);
 assert.equal(x.manualStopRequired,false);
 assert.deepEqual(log.filter(v=>v.endsWith(':STOP')),[]);
 assert.equal(log.length,4);
 assert.equal(x.completionEvidence.worker.repeats,2);
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

test('hanging Agent failure-recovery STOP is bounded and cannot be reported as complete',async()=>{
 const log=[];
 const hanging={start:async spec=>({
  eventId:spec.eventId,eventType:spec.eventType,action:'START',
  confirmed:true,playbackState:'ACTIVE',confirmedAt:new Date(now).toISOString()}),
  waitUntilCompleted:async()=>({completed:false,reason:'PLAYER_FAILED'}),
  stop:()=>{log.push('agent STOP called');return new Promise(()=>{});}};
 const result=await runMchsTwoChannelExecution({
  event,authorization,worker:channel('worker',log),agent:hanging,
  now:()=>now,stopTimeoutMs:100});
 assert.equal(result.ok,false);
 assert.equal(result.reason,'COMPLETION_NOT_CONFIRMED');
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

test('without completion adapters both channels are stopped, not treated as complete',async()=>{
 const log=[];const worker=channel('worker',log),agent=channel('agent',log);
 delete agent.waitUntilCompleted;
 const x=await runMchsTwoChannelExecution({event,authorization,worker,agent,now:()=>now});
 assert.equal(x.ok,false);assert.equal(x.reason,'COMPLETION_ADAPTER_MISSING');
 assert.ok(log.includes('worker:STOP'));assert.ok(log.includes('agent:STOP'));
});
test('completion timeout triggers independent STOP requests',async()=>{
 const log=[];const worker=channel('worker',log),agent=channel('agent',log);
 agent.waitUntilCompleted=()=>new Promise(()=>{});
 const x=await runMchsTwoChannelExecution({event,authorization,worker,agent,now:()=>now,completionTimeoutMs:100});
 assert.equal(x.ok,false);assert.equal(x.reason,'COMPLETION_TIMEOUT');
 assert.ok(log.includes('worker:STOP'));assert.ok(log.includes('agent:STOP'));
});

test('event mismatch in either natural-completion receipt invokes fault recovery',async()=>{
 const log=[];
 const agent=channel('agent',log);
 agent.waitUntilCompleted=async()=>({completed:true,eventId:'old-event',
  repeats:event.repeats,reason:'FILE_COMPLETED'});
 const result=await runMchsTwoChannelExecution({
  event,authorization,worker:channel('worker',log),agent,now:()=>now});
 assert.equal(result.ok,false);
 assert.equal(result.reason,'COMPLETION_NOT_CONFIRMED');
 assert.ok(log.includes('worker:STOP'));
 assert.ok(log.includes('agent:STOP'));
});
test('short repeat count in natural completion is not a valid finish',async()=>{
 const log=[];const agent=channel('agent',log);
 agent.waitUntilCompleted=async()=>({completed:true,eventId:event.id,
  repeats:1,reason:'FILE_COMPLETED'});
 const result=await runMchsTwoChannelExecution({
  event,authorization,worker:channel('worker',log),agent,now:()=>now});
 assert.equal(result.ok,false);assert.equal(result.reason,'COMPLETION_NOT_CONFIRMED');
});
test('a generic completed flag without natural FILE_COMPLETED cannot pass',async()=>{
 const log=[];const agent=channel('agent',log);
 agent.waitUntilCompleted=async()=>({completed:true,eventId:event.id,repeats:2});
 const result=await runMchsTwoChannelExecution({
  event,authorization,worker:channel('worker',log),agent,now:()=>now});
 assert.equal(result.ok,false);assert.equal(result.reason,'COMPLETION_NOT_CONFIRMED');
});
