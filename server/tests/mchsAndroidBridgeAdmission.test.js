import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMissileProvenance} from '../src/lib/mchsMissileProvenance.js';
import {admitAuthenticatedAndroidObservation} from '../src/lib/mchsAndroidBridgeAdmission.js';
import {bindAndroidAlarmCandidates} from '../src/lib/mchsAndroidAlarmBinding.js';
import {observeAndroidEvents} from '../src/lib/mchsAndroidObservationMonitor.js';

const nowMs=Date.parse('2026-11-06T12:00:00Z');
const input={eventId:'android-112',title:'Ракетная опасность',
 body:'Ракетная опасность объявлена в Тульской области',
 channelId:'tula-channel',region:'Тульская область',occurredAt:'2026-11-06T11:59:55Z'};
const check=(v,channels=['tula-channel'])=>
 assessMissileProvenance(v,{allowedChannels:channels,nowMs});

test('signed and allowlisted recent Tula missile danger is eligible for queue staging',()=>{
 const p=check(input);
 assert.equal(admitAuthenticatedAndroidObservation(p),true);
 assert.equal(p.officiallyVerified,false);
 const event={id:'event-1',source:'MCHS_ANDROID',sourceEventId:input.eventId,
  occurredAt:input.occurredAt,title:input.title,body:input.body,
  region:input.region,verified:true};
 const observed=observeAndroidEvents(null,[event],{nowMs});
 assert.equal(observed.newEntries[0].result,'OBSERVED');
 const bound=bindAndroidAlarmCandidates({entries:observed.newEntries,
  observations:[event],assets:[{id:'asset-1',category:'ALARM',
   mimeType:'audio/wav',durationMs:3000}],
  rules:{MISSILE_DANGER:{mode:'REVIEW',audioAssetId:'asset-1'}},
  nowMs,dangerRepeats:2});
 assert.equal(bound.eligible.length,1);
 assert.equal(bound.eligible[0].repetitions,2);
 assert.equal(bound.dispatchAuthorized,false);
});
test('recent Tula all-clear admits only a single audio repeat',()=>{
 const e={...input,title:'Отбой ракетной опасности',body:'Отбой ракетной опасности'};
 assert.equal(admitAuthenticatedAndroidObservation(check(e)),true);
});
test('other notification types never admit automatic station audio',()=>{
 const e={...input,title:'Опасность БПЛА',body:'Опасность атаки БПЛА'};
 assert.equal(admitAuthenticatedAndroidObservation(check(e)),false);
});
test('region, freshness, and configured bridge channel remain bounded',()=>{
 assert.equal(admitAuthenticatedAndroidObservation(check({...input,region:'Москва'})),false);
 assert.equal(admitAuthenticatedAndroidObservation(check(input,['another-channel'])),false);
 assert.equal(admitAuthenticatedAndroidObservation(check(input,[])),false);
 assert.equal(admitAuthenticatedAndroidObservation(check({...input,occurredAt:'2026-11-06T11:57:30Z'})),false);
});
test('admission cannot be inferred from unsigned/malformed provenance',()=>{
 assert.equal(admitAuthenticatedAndroidObservation({acceptable:true,
  eventType:'MISSILE_DANGER'}),false);
 assert.equal(admitAuthenticatedAndroidObservation(null),false);
});
