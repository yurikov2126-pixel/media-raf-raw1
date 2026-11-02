import test from 'node:test';
import assert from 'node:assert/strict';
import {planMchsAndroidControlledTrial} from '../src/lib/mchsAndroidControlledTrial.js';
const now=Date.parse('2026-11-03T12:00:00Z');
const event={id:'e1',sourceEventId:'android1',source:'MCHS_ANDROID',verified:true,
 title:'Ракетная опасность',body:'Ракетная опасность',region:'Тульская область',
 occurredAt:new Date(now-1000).toISOString()};
const rules={MISSILE_DANGER:{mode:'REVIEW',audioAssetId:'alarm',repeats:2},
 MISSILE_ALL_CLEAR:{mode:'REVIEW',audioAssetId:'clear'}};
const ready={event,checkpoint:{state:'CLEAR'},rules,workerReady:true,agentReady:true,
 stopReady:true,sourceOfficiallyVerified:true,nowMs:now};
test('eligible real event is queued only as preflight, never broadcasts',()=>{
 const x=planMchsAndroidControlledTrial(ready);
 assert.equal(x.eligibleForQueue,true);assert.equal(x.repeats,2);
 assert.equal(x.automaticPlaybackEnabled,false);assert.equal(x.executionAuthorized,false);
});
test('missing source verification or STOP fails closed',()=>{
 for(const patch of [{sourceOfficiallyVerified:false},{stopReady:false},
 {event:{...event,region:'Другой регион'}},{event:{...event,occurredAt:new Date(now-500000).toISOString()}}]){
  const x=planMchsAndroidControlledTrial({...ready,...patch});assert.equal(x.eligibleForQueue,false);
 }
});
test('replayed Android source ID and repeated DANGER rejected',()=>{
 assert.equal(planMchsAndroidControlledTrial({...ready,checkpoint:{state:'DANGER'}}).eligibleForQueue,false);
 assert.equal(planMchsAndroidControlledTrial({...ready,seenIds:new Set(['android1'])}).eligibleForQueue,false);
});
