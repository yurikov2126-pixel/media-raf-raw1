import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMchsStationCommand} from '../src/lib/mchsStationCommandContract.js';
import {reconcileMchsStationClaims} from '../src/lib/mchsStationClaimRecovery.js';
import {dispatchNewAndroidStationBindings} from '../src/lib/mchsAndroidStationBridge.js';

const admitted='2026-11-05T20:00:10.000Z';
const occurred='2026-11-05T20:00:00.000Z';
const nowMs=Date.parse(occurred)+12*60*1000;
const cmd={action:'START',eventId:'evt1',eventType:'MISSILE_ALL_CLEAR',
 assetId:'alarm_asset',repeats:1,occurredAt:occurred,admittedAt:admitted};
const item={eventId:'evt1',sourceEventId:'source1',assetId:'alarm_asset',
 eventType:'MISSILE_ALL_CLEAR',repetitions:1,occurredAt:occurred,
 createdAt:admitted,status:'DISPATCHING',claimedAt:admitted};
const worker=(history=[],session=null)=>({ok:true,data:{ok:true,phase:'COMPLETE',
 active:false,preparing:false,terminalJournal:{healthy:true},
 terminalHistory:history,session}});
test('original Android time remains untouched while admitted event can wait 12 minutes',()=>{
 const validated=validateMchsStationCommand(cmd,{nowMs});
 assert.equal(validated.ok,true,validated.reason);
 assert.equal(validated.occurredAt,occurred);
 assert.equal(validated.admittedAt,admitted);
});
test('no admission record must still use original 120-second bound',()=>{
 const denied=validateMchsStationCommand({...cmd,admittedAt:undefined},{nowMs});
 assert.equal(denied.ok,false);
 assert.equal(denied.reason,'EVENT_NOT_FRESH');
});
test('cannot backdate admission, claim an old event, or exceed 4-hour queued limit',()=>{
 const bad=validateMchsStationCommand({...cmd,admittedAt:'2026-11-05T20:05:00.000Z'},{nowMs});
 assert.equal(bad.reason,'QUEUE_ADMISSION_NOT_FRESH');
 const before=validateMchsStationCommand({...cmd,admittedAt:'2026-11-05T19:50:00.000Z'},{nowMs});
 assert.equal(before.reason,'QUEUE_ADMISSION_NOT_FRESH');
 const ancient=validateMchsStationCommand(cmd,{nowMs:Date.parse(admitted)+4*3600*1000+1});
 assert.equal(ancient.reason,'QUEUE_ADMISSION_NOT_FRESH');
});
test('unknown DISPATCHING claim is never automatically replayed',()=>{
 const result=reconcileMchsStationClaims([item],worker(),{nowMs});
 assert.equal(result.items[0].status,'UNKNOWN');
 assert.equal(result.recovered.length,0);
});
test('reboot recovery confirms same eventId from terminal journal',()=>{
 const entry={eventId:'evt1',phase:'COMPLETE'};
 const result=reconcileMchsStationClaims([item],worker([entry]),{nowMs});
 assert.equal(result.items[0].status,'START_ACCEPTED');
 assert.deepEqual(result.recovered.map(x=>x.eventId),['evt1']);
});
test('active Worker session recovers claimed START without replay',()=>{
 const result=reconcileMchsStationClaims([item],worker([],{eventId:'evt1'}),{nowMs});
 assert.equal(result.items[0].status,'START_ACCEPTED');
});
test('unhealthy or unavailable journal cannot resolve uncertain claim',()=>{
 const result=reconcileMchsStationClaims([item],
  {ok:true,data:{terminalJournal:{healthy:false},terminalHistory:[{eventId:'evt1'}]}},{nowMs});
 assert.equal(result.items[0].status,'DISPATCHING');
 assert.equal(result.changed,false);
});
test('bridge forwards actual admission time, not a spoofed fresh occurrence',async()=>{
 const observation={id:'evt1',sourceEventId:'source1',source:'MCHS_ANDROID',
  verified:true,region:'Тульская область',occurredAt:occurred};
 const sent=[];
 const bound={...item,status:'STAGED',officialSourceVerified:false,dispatchAuthorized:false};
 const result=await dispatchNewAndroidStationBindings({
  enabled:true,intents:[bound],observations:[observation],nowMs,
  request:async cmd=>{sent.push(cmd);return {ok:true};}});
 assert.equal(result.results[0].ok,true);
 assert.equal(sent[0].admittedAt,admitted);
 assert.equal(sent[0].occurredAt,occurred);
});
