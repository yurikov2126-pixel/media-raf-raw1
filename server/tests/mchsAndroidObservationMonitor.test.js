import test from 'node:test';
import assert from 'node:assert/strict';
import {observeAndroidEvents} from '../src/lib/mchsAndroidObservationMonitor.js';
const now=Date.parse('2026-11-02T12:00:00Z');
const event={id:'1',sourceEventId:'source-1',title:'Ракетная опасность',body:'Тульская область',
 source:'MCHS_ANDROID',verified:true,region:'Тульская область',
 occurredAt:new Date(now-5000).toISOString()};
test('automatic observation records decisions without authorizing ALARM',()=>{
 const first=observeAndroidEvents(null,[event],{nowMs:now});
 assert.equal(first.newEntries.length,1);
 assert.equal(first.newEntries[0].eventType,'MISSILE_DANGER');
 assert.equal(first.dispatchAuthorized,false);
 assert.equal(first.automaticPlaybackEnabled,false);
 const second=observeAndroidEvents(first.state,[event],{nowMs:now+1000});
 assert.equal(second.newEntries.length,0);
});
test('stale records remain non-executable and bounded',()=>{
 const state=observeAndroidEvents(null,[{...event,occurredAt:new Date(now-500000).toISOString()}],{nowMs:now});
 assert.equal(state.newEntries[0].result,'REJECTED');
 const many=Array.from({length:520},(_,i)=>({...event,id:String(i),sourceEventId:'id-'+i}));
 const processed=observeAndroidEvents(null,many,{nowMs:now});
 assert.equal(processed.state.seenIds.length,500);
 assert.equal(processed.state.entries.length,100);
});
