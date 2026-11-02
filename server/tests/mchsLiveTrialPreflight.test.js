import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsLiveTrialPreflight} from '../src/lib/mchsLiveTrialPreflight.js';
const rules={MISSILE_DANGER:{mode:'REVIEW',audioAssetId:'danger',repeats:3},MISSILE_ALL_CLEAR:{mode:'REVIEW',audioAssetId:'clear',repeats:5}};
test('only two required missile events, with all-clear once',()=>{
 const report=assessMchsLiveTrialPreflight({rules,assets:[{id:'danger'},{id:'clear'}],workerReachable:true,agentConfirmed:true,stopConfirmed:true,esp32Ready:true});
 assert.equal(report.types.length,2);
 assert.equal(report.types[0].repeats,3);
 assert.equal(report.types[1].repeats,1);
 assert.equal(report.configurationReady,true);
 assert.equal(report.automaticPlaybackEnabled,false);
 assert.equal(report.amplifierActuationAuthorized,false);
});
test('missing track, unsafe repeats and missing emergency stop keep fail closed',()=>{
 const report=assessMchsLiveTrialPreflight({rules:{...rules,MISSILE_DANGER:{...rules.MISSILE_DANGER,repeats:9}},assets:[{id:'danger'}],workerReachable:true,agentConfirmed:true});
 assert.ok(report.holds.includes('STOP_NOT_CONFIRMED'));
 assert.ok(report.holds.includes('ALARM_RULES_INCOMPLETE'));
 assert.equal(report.configurationReady,false);
});
