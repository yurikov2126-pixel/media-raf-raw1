import test from 'node:test';
import assert from 'node:assert/strict';
import {planMchsAndroidAlarmEvent} from '../src/lib/mchsAndroidAlarmPlanner.js';
const now=Date.parse('2026-11-02T10:00:00Z');
const mk=(title,id)=>({id,source:'MCHS_ANDROID',sourceEventId:id,verified:true,region:'Тульская область',title,body:'Тульская область',occurredAt:new Date(now-10000).toISOString()});
const settings={dangerAssetId:'danger',clearAssetId:'clear',dangerRepeats:3};
test('danger produces bounded 3 repeated commands, but no dispatch authority',()=>{
 const x=planMchsAndroidAlarmEvent({event:mk('Ракетная опасность','a'),checkpoint:{state:'CLEAR'},settings,nowMs:now});
 assert.equal(x.action,'DANGER_SEQUENCE');assert.deepEqual(x.steps.map(v=>v.assetId),['danger','danger','danger']);
 assert.equal(x.dispatchAuthorized,false);assert.equal(x.automaticPlaybackEnabled,false);
});
test('all-clear only once if danger was active',()=>{
 const x=planMchsAndroidAlarmEvent({event:mk('Отбой ракетной опасности','b'),checkpoint:{state:'DANGER'},settings,nowMs:now});
 assert.equal(x.steps.length,1);assert.equal(x.action,'ALL_CLEAR_SEQUENCE');assert.equal(x.nextState,'CLEAR');
 assert.equal(planMchsAndroidAlarmEvent({event:mk('Отбой ракетной опасности','c'),checkpoint:{state:'CLEAR'},settings,nowMs:now}).reason,'CLEAR_WITHOUT_ACTIVE_DANGER');
});
test('duplicates, missing assets, stale and unverified events blocked',()=>{
 assert.equal(planMchsAndroidAlarmEvent({event:mk('Ракетная опасность','a'),checkpoint:{state:'CLEAR',processedIds:['a']},settings,nowMs:now}).reason,'DUPLICATE');
 assert.equal(planMchsAndroidAlarmEvent({event:mk('Ракетная опасность','a'),checkpoint:{state:'CLEAR'},settings:{},nowMs:now}).reason,'DANGER_ALARM_NOT_CONFIGURED');
 assert.equal(planMchsAndroidAlarmEvent({event:{...mk('Ракетная опасность','a'),verified:false},checkpoint:{state:'CLEAR'},settings,nowMs:now}).reason,'UNVERIFIED_OBSERVATION');
 assert.equal(planMchsAndroidAlarmEvent({event:{...mk('Ракетная опасность','a'),occurredAt:new Date(now-200000).toISOString()},checkpoint:{state:'CLEAR'},settings,nowMs:now}).reason,'STALE_EVENT');
});
