import test from 'node:test';
import assert from 'node:assert/strict';
import {bindAndroidAlarmCandidates,stageBoundAndroidIntents} from '../src/lib/mchsAndroidAlarmBinding.js';

const now=Date.parse('2026-11-03T08:00:00Z');
const event=(id,title,overrides={})=>({
 id,sourceEventId:'push-'+id,title,body:'Тульская область',
 source:'MCHS_ANDROID',verified:true,region:'Тульская область',
 occurredAt:new Date(now-2000).toISOString(),...overrides
});
const danger=event('e1','Ракетная опасность');
const clear=event('e2','Отбой ракетной опасности');
const entries=[
 {eventId:'e1',sourceEventId:'push-e1',eventType:'MISSILE_DANGER',result:'OBSERVED'},
 {eventId:'e2',sourceEventId:'push-e2',eventType:'MISSILE_ALL_CLEAR',result:'OBSERVED'}
];
const rules={
 MISSILE_DANGER:{mode:'REVIEW',audioAssetId:'alarm_danger'},
 MISSILE_ALL_CLEAR:{mode:'REVIEW',audioAssetId:'alarm_clear'}
};
const assets=[
 {id:'alarm_danger',category:'ALARM',mimeType:'audio/mpeg',durationMs:2500},
 {id:'alarm_clear',category:'ALARM',mimeType:'audio/wav',durationMs:3000}
];
const bind=(override={})=>bindAndroidAlarmCandidates({
 entries,observations:[danger,clear],rules,assets,dangerRepeats:4,nowMs:now,...override
});
test('binds exact configured assets, four repeats for danger, one for clear',()=>{
 const plan=bind();
 assert.equal(plan.eligible.length,2);
 assert.deepEqual(plan.eligible.map(x=>x.audioAssetId),['alarm_danger','alarm_clear']);
 assert.deepEqual(plan.eligible.map(x=>x.repetitions),[4,1]);
 assert.deepEqual(plan.eligible.map(x=>x.expectedDurationMs),[10000,3000]);
 assert.equal(plan.dispatchAuthorized,false);
 assert.equal(plan.eligible[0].officialSourceVerified,false);
});
test('permanent durable idempotency after restart or repeated monitor poll',()=>{
 const first=stageBoundAndroidIntents(null,bind().eligible,{now:new Date(now).toISOString()});
 assert.equal(first.added.length,2);
 assert.deepEqual(first.ledger.items.map(x=>x.status),['STAGED','STAGED']);
 assert.deepEqual(first.ledger.items.map(x=>x.dispatchAuthorized),[false,false]);
 const replay=stageBoundAndroidIntents(JSON.parse(JSON.stringify(first.ledger)),
  bind().eligible,{now:new Date(now+1000).toISOString()});
 assert.equal(replay.added.length,0);
 assert.equal(replay.ledger.items.length,2);
 assert.deepEqual(replay.ledger.items.map(x=>x.repetitions),[4,1]);
});
test('rejects unverified, stale, wrong-region, and mismatched source events',()=>{
 const variations=[
  {...danger,verified:false},
  {...danger,source:'UNTRUSTED'},
  {...danger,region:'Другая область'},
  {...danger,occurredAt:new Date(now-200000).toISOString()},
  {...danger,sourceEventId:'changed'},
  {...danger,title:'Отбой ракетной опасности'}
 ];
 for(const v of variations){
  const plan=bind({entries:[entries[0]],observations:[v]});
  assert.equal(plan.eligible.length,0);
  assert.equal(plan.rejected.length,1);
 }
});
test('missing rule or invalid ALARM media does not create executable intent',()=>{
 const x=bind({rules:{...rules,MISSILE_DANGER:{mode:'IGNORE',audioAssetId:'alarm_danger'}},
  assets:[{id:'alarm_clear',category:'ALARM',mimeType:'audio/wav',durationMs:3000}]});
 assert.equal(x.eligible.length,1);
 assert.equal(x.rejected[0].reason,'RULE_NOT_CONFIGURED');
 const y=bind({assets:[{...assets[0],category:'MUSIC'},assets[1]]});
 assert.equal(y.eligible.length,1);
 assert.equal(y.rejected[0].reason,'ALARM_ASSET_UNAVAILABLE');
});
test('never promotes an arbitrary malformed proposed asset to the ledger',()=>{
 const candidate={...bind().eligible[0],audioAssetId:'../escape'};
 assert.equal(stageBoundAndroidIntents(null,[candidate]).added.length,0);
 const publicCommand={...bind().eligible[0],dispatchAuthorized:true};
 assert.equal(stageBoundAndroidIntents(null,[publicCommand]).added.length,0);
});
