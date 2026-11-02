import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {dispatchIsolatedMchsEvent} from '../src/lib/mchsIsolatedEventDispatcher.js';
const now=Date.parse('2026-11-03T12:00:00Z');
const bytes=Buffer.from('isolated fixture');
const sha256=createHash('sha256').update(bytes).digest('hex');
const observation={id:'e1',sourceEventId:'source1',source:'MCHS_ANDROID',
 verified:true,region:'Тульская область',title:'Ракетная опасность',
 body:'Ракетная опасность',occurredAt:new Date(now-1000).toISOString()};
const rules={MISSILE_DANGER:{mode:'REVIEW',audioAssetId:'alarm',repeats:2}};
const asset={id:'alarm',eventType:'MISSILE_DANGER',sha256};
const channel={eventId:'e1',assetId:'alarm',sha256,repeats:2};
const authorization={approved:true,mode:'ISOLATED_TRIAL',outputIsolationVerified:true,
 publicStreamAllowed:false,amplifierAllowed:false};
const base={observation,checkpoint:{state:'CLEAR'},rules,asset,bytes,
 workerAsset:channel,agentAsset:channel,officialSourceVerified:true,
 authorization,now:()=>now};
function adapter(events,label){
 return {async start(spec){events.push(label+':START');return {eventId:spec.eventId,eventType:spec.eventType,action:'START',
  confirmed:true,playbackState:'ACTIVE',confirmedAt:new Date(now).toISOString()};},
 async waitUntilCompleted(){events.push(label+':DONE');return {completed:true};},
 async stop(spec){events.push(label+':STOP');return {eventId:spec.eventId,eventType:spec.eventType,action:'STOP',
  confirmed:true,playbackState:'STOPPED',confirmedAt:new Date(now).toISOString()};}};
}
test('verified event executes both isolated channels, no public authorization',async()=>{
 const events=[];
 const result=await dispatchIsolatedMchsEvent({...base,worker:adapter(events,'worker'),agent:adapter(events,'agent')});
 assert.equal(result.ok,true,result.reason);assert.equal(result.automaticBroadcastEnabled,false);
 assert.equal(result.checkpointCommitted,false);
 assert.ok(events.includes('worker:START'));assert.ok(events.includes('agent:START'));
 assert.ok(events.includes('worker:DONE'));assert.ok(events.includes('agent:DONE'));
});
test('missing physical isolation never invokes output adapters',async()=>{
 const events=[];
 const result=await dispatchIsolatedMchsEvent({...base,
  authorization:{...authorization,outputIsolationVerified:false},
  worker:adapter(events,'worker'),agent:adapter(events,'agent')});
 assert.equal(result.ok,false);assert.equal(result.reason,'ISOLATED_TEST_AUTHORIZATION_REQUIRED');
 assert.deepEqual(events,[]);
});
test('corrupt ALARM or unverified origin fails closed before START',async()=>{
 const events=[];
 for(const patch of [{bytes:Buffer.from('bad')},{officialSourceVerified:false}]){
  const result=await dispatchIsolatedMchsEvent({...base,...patch,
   worker:adapter(events,'worker'),agent:adapter(events,'agent')});
  assert.equal(result.ok,false);
 }
 assert.deepEqual(events,[]);
});
