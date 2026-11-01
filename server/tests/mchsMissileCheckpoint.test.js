import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceMissileCheckpoint,emptyMissileCheckpoint} from '../src/lib/mchsMissileCheckpoint.js';
const t=Date.parse('2026-11-01T12:00:00Z');
const rules={MISSILE_DANGER:{mode:'REVIEW',audioAssetId:'a'},MISSILE_ALL_CLEAR:{mode:'REVIEW',audioAssetId:'b'}};
const event=(id,title,ms,extra={})=>({id,source:'MCHS_ANDROID',sourceEventId:id,title,body:'',verified:true,region:'Тульская область',occurredAt:new Date(ms),...extra});
const opts={rules,assets:new Set(['a','b']),nowMs:t};
test('verified danger and clear persist across reconciliation',()=>{
 const first=advanceMissileCheckpoint(emptyMissileCheckpoint(),[event('e1','Ракетная опасность',t-20000)],opts);
 assert.equal(first.checkpoint.state,'DANGER');
 const next=advanceMissileCheckpoint(first.checkpoint,[event('e1','Ракетная опасность',t-20000),event('e2','Отбой ракетной опасности',t-10000)],opts);
 assert.equal(next.checkpoint.state,'CLEAR');
 assert.equal(next.decisions[0].reason,'DUPLICATE');
 assert.equal(next.decisions[1].eligible,true);
});
test('all clear without danger cannot be accepted',()=>{
 const result=advanceMissileCheckpoint(emptyMissileCheckpoint(),[event('e2','Отбой ракетной опасности',t-10000)],opts);
 assert.equal(result.checkpoint.state,'UNKNOWN');
 assert.equal(result.decisions[0].reason,'CLEAR_WITHOUT_DANGER');
});
test('old or unverified events never change state',()=>{
 const result=advanceMissileCheckpoint(emptyMissileCheckpoint(),[
  event('old','Ракетная опасность',t-900000),
  event('notverified','Ракетная опасность',t-10000,{verified:false})
 ],opts);
 assert.equal(result.checkpoint.state,'UNKNOWN');
 assert.equal(result.decisions.every(d=>!d.eligible),true);
});
test('other types excluded from checkpoint',()=>{
 const result=advanceMissileCheckpoint(emptyMissileCheckpoint(),[event('drone','Опасность атаки БПЛА',t-10000)],opts);
 assert.equal(result.checkpoint.state,'UNKNOWN');
});
