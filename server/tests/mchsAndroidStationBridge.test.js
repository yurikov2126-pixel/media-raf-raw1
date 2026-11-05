import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchNewAndroidStationBindings} from '../src/lib/mchsAndroidStationBridge.js';

const occurredAt='2026-11-05T15:00:00.000Z',nowMs=Date.parse(occurredAt)+10000;
const event={id:'evt_123',sourceEventId:'android_12',source:'MCHS_ANDROID',verified:true,
 region:'Тульская область',occurredAt};
const intent={eventId:event.id,sourceEventId:event.sourceEventId,eventType:'MISSILE_DANGER',
 assetId:'asset_12',repetitions:3,status:'STAGED',officialSourceVerified:false,dispatchAuthorized:false};
test('disabled bridge never sends audio',async()=>{
 let calls=0;
 const out=await dispatchNewAndroidStationBindings({intents:[intent],observations:[event],
  request:async()=>{calls++;return {ok:true};},nowMs});
 assert.equal(calls,0);assert.equal(out.enabled,false);
});
test('fresh committed binding creates exactly one event-bound command',async()=>{
 const commands=[];
 const out=await dispatchNewAndroidStationBindings({enabled:true,intents:[intent],observations:[event],
  nowMs,request:async c=>{commands.push(c);return {ok:true,data:{status:'PREEMPTING'}};}});
 assert.equal(out.results[0].ok,true);assert.equal(commands.length,1);
 assert.deepEqual(commands[0],{action:'START',eventId:'evt_123',
 eventType:'MISSILE_DANGER',assetId:'asset_12',repeats:3,occurredAt});
});
test('all-clear is single play',async()=>{
 const sent=[];
 const out=await dispatchNewAndroidStationBindings({enabled:true,nowMs,
  intents:[{...intent,eventType:'MISSILE_ALL_CLEAR',repetitions:1}],
  observations:[event],request:async c=>{sent.push(c);return {ok:true};}});
 assert.equal(out.results[0].ok,true);assert.equal(sent[0].repeats,1);
});
test('reject mismatched Android origin and invalid repetitions',async()=>{
 let calls=0;const request=async()=>{calls++;return {ok:true};};
 const a=await dispatchNewAndroidStationBindings({enabled:true,nowMs,
  intents:[intent],observations:[{...event,verified:false}],request});
 const b=await dispatchNewAndroidStationBindings({enabled:true,nowMs,
  intents:[{...intent,eventType:'MISSILE_ALL_CLEAR',repetitions:2}],observations:[event],request});
 assert.equal(calls,0);assert.equal(a.results[0].reason,'ANDROID_BINDING_MISMATCH');
 assert.equal(b.results[0].reason,'INVALID_EVENT_BINDING');
});
test('stale event and failed Worker response never count as success',async()=>{
 let calls=0;
 const stale=await dispatchNewAndroidStationBindings({enabled:true,nowMs:nowMs+180000,
  intents:[intent],observations:[event],request:async()=>{calls++;return {ok:true};}});
 assert.equal(calls,0);assert.equal(stale.results[0].reason,'EVENT_NOT_FRESH');
 const failure=await dispatchNewAndroidStationBindings({enabled:true,nowMs,
  intents:[intent],observations:[event],request:async()=>({ok:false,reason:'COORDINATOR_DISABLED'})});
 assert.equal(failure.results[0].ok,false);
});
