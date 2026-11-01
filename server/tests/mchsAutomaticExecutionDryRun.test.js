import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMchsDryRunExecution} from '../src/lib/mchsAutomaticExecutionDryRun.js';
const now=Date.parse('2026-11-02T10:00:00Z');
const event=(id,eventType,time)=>({id,sourceEventId:id,source:'MCHS_ANDROID',verified:true,region:'Тульская область',eventType,occurredAt:new Date(now+time).toISOString()});
const rules={MISSILE_DANGER:{audioAssetId:'danger'},MISSILE_ALL_CLEAR:{audioAssetId:'clear'}};
test('dry-run creates repeated danger and single clear without playing sound',()=>{
 const plan=buildMchsDryRunExecution({observations:[event('1','MISSILE_DANGER',-20000),event('2','MISSILE_ALL_CLEAR',-10000)],rules,dangerRepeats:3,nowMs:now});
 assert.deepEqual(plan.steps.map(s=>s.assetId),['danger','danger','danger','clear']);
 assert.equal(plan.finalState,'CLEAR');assert.equal(plan.audioStarted,false);
 assert.equal(plan.automaticPlaybackEnabled,false);
});
test('duplicate and premature all-clear rejected',()=>{
 const plan=buildMchsDryRunExecution({observations:[event('1','MISSILE_ALL_CLEAR',-30000),event('2','MISSILE_DANGER',-20000),event('2','MISSILE_DANGER',-10000)],rules,nowMs:now});
 assert.equal(plan.decisions[0].reason,'CLEAR_WITHOUT_DANGER');
 assert.equal(plan.steps.length,1);
 assert.equal(plan.decisions[2].reason,'DUPLICATE');
});
