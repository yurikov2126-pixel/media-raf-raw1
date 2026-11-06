import test from 'node:test';
import assert from 'node:assert/strict';
import {
 assessMchsPushCandidate,buildMchsPushPayload,MCHS_PUSH_MAX_AGE_MS
} from '../src/lib/mchsPushEligibility.js';
import {assessMissileProvenance} from '../src/lib/mchsMissileProvenance.js';
import {admitAuthenticatedAndroidObservation} from '../src/lib/mchsAndroidBridgeAdmission.js';

const nowMs=Date.parse('2026-11-06T20:00:00.000Z');
const common={eventId:'android:event-42',channelId:'allowed-tula',
 region:'Тульская область',occurredAt:'2026-11-06T19:59:55.000Z'};
const cases=[
 ['UAV_DANGER','Опасность атаки БПЛА','Объявлена опасность атаки БПЛА'],
 ['UAV_ALL_CLEAR','Отбой опасности атаки БПЛА','Объявлен отбой опасности атаки БПЛА'],
 ['MISSILE_DANGER','Ракетная опасность','Объявлена ракетная опасность'],
 ['MISSILE_ALL_CLEAR','Отбой ракетной опасности','Объявлен отбой ракетной опасности']
];
for(const [type,title,body] of cases){
 test('four signed Android types produce PUSH: '+type,()=>{
  const input={...common,title,body};
  const decision=assessMchsPushCandidate(input,{allowedChannels:['allowed-tula'],nowMs});
  assert.deepEqual(decision,{eligible:true,type,reason:null});
  const payload=buildMchsPushPayload({type,eventId:input.eventId,body:input.body});
  assert.equal(payload.title,title);
  assert.equal(payload.url,'/app');
  assert.equal(payload.tag,'mchs-'+common.eventId);
  assert.equal(payload.requireInteraction,type.endsWith('_DANGER'));
 });
}
test('UAV PUSH is independent of the missile-only radio playout admission',()=>{
 const input={...common,title:'Опасность атаки БПЛА',
  body:'Объявлена опасность атаки БПЛА'};
 const push=assessMchsPushCandidate(input,{allowedChannels:['allowed-tula'],nowMs});
 const audio=admitAuthenticatedAndroidObservation(assessMissileProvenance(input,{
  allowedChannels:['allowed-tula'],nowMs}));
 assert.equal(push.eligible,true);
 assert.equal(audio,false);
});
test('reject unrecognized hazards, channel mismatch, region mismatch and stale events',()=>{
 const cases=[
  [{...common,title:'Погода',body:'Дождь'},'UNRECOGNIZED_TYPE'],
  [{...common,title:'Ракетная опасность',body:'Ракетная опасность',channelId:'other'},'CHANNEL_NOT_ALLOWLISTED'],
  [{...common,title:'Ракетная опасность',body:'Ракетная опасность',region:'Другая область'},'REGION_MISMATCH'],
  [{...common,title:'Ракетная опасность',body:'Ракетная опасность',occurredAt:'2026-11-06T19:57:00Z'},'STALE_OR_UNKNOWN_TIME']
 ];
 for(const [input,reason] of cases){
  const result=assessMchsPushCandidate(input,{allowedChannels:['allowed-tula'],nowMs});
  assert.equal(result.eligible,false);
  assert.equal(result.reason,reason);
 }
 const missing=assessMchsPushCandidate({...common,title:'Ракетная опасность',
  body:'Ракетная опасность'},{allowedChannels:[],nowMs});
 assert.equal(missing.reason,'NO_TRUSTED_CHANNEL');
});
test('danger and all-clear use short payloads and no official attribution',()=>{
 const payload=buildMchsPushPayload({type:'MISSILE_DANGER',eventId:'a',
  body:'Текст. '.repeat(100)});
 assert.ok(payload.body.length<=220);
 assert.equal(payload.title,'Ракетная опасность');
 assert.equal(MCHS_PUSH_MAX_AGE_MS,120000);
});
