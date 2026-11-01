import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMissileAutoEvent,missileNextState} from '../src/lib/mchsMissileAutoGate.js';
const now=Date.parse('2026-11-01T12:00:00Z');
const rules={MISSILE_DANGER:{mode:'REVIEW',audioAssetId:'alarm-danger'},MISSILE_ALL_CLEAR:{mode:'REVIEW',audioAssetId:'alarm-clear'}};
const event=(title,patch={})=>({id:'1',source:'MCHS_ANDROID',sourceEventId:'event-1',title,body:'',region:'Тульская область',verified:true,occurredAt:new Date(now-10000),...patch});
test('exactly the two missile types are eligible',()=>{
 assert.equal(assessMissileAutoEvent(event('Ракетная опасность'),{nowMs:now,rules}).audioAssetId,'alarm-danger');
 assert.equal(assessMissileAutoEvent(event('Отбой ракетной опасности'),{nowMs:now,rules}).audioAssetId,'alarm-clear');
 assert.equal(assessMissileAutoEvent(event('Опасность атаки БПЛА'),{nowMs:now,rules}).reason,'TYPE_NOT_AUTOMATED');
});
test('unverified, duplicate, stale, region and spoofed events fail closed',()=>{
 for(const [patch,reason] of [[{verified:false},'NOT_VERIFIED'],[{region:'Другая область'},'REGION_UNVERIFIED'],[{source:'OTHER'},'UNTRUSTED_SOURCE'],[{occurredAt:new Date(now-400000)},'STALE_OR_UNKNOWN_TIME']]){
  assert.equal(assessMissileAutoEvent(event('Ракетная опасность',patch),{nowMs:now,rules}).reason,reason);
 }
 assert.equal(assessMissileAutoEvent(event('Ракетная опасность'),{nowMs:now,rules,seenIds:new Set(['event-1'])}).reason,'DUPLICATE');
});
test('all-clear follows danger, repeats do not cause another action',()=>{
 assert.equal(missileNextState('CLEAR','MISSILE_ALL_CLEAR').accepted,false);
 assert.deepEqual(missileNextState('CLEAR','MISSILE_DANGER'),{accepted:true,state:'DANGER',reason:null});
 assert.equal(missileNextState('DANGER','MISSILE_DANGER').reason,'DUPLICATE_DANGER');
 assert.equal(missileNextState('DANGER','MISSILE_ALL_CLEAR').state,'CLEAR');
});
