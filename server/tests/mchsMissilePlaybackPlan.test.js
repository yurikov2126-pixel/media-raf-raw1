import test from 'node:test';
import assert from 'node:assert/strict';
import {planMissilePlayback} from '../src/lib/mchsMissilePlaybackPlan.js';
const danger={eligible:true,eventId:'e1',eventType:'MISSILE_DANGER',audioAssetId:'a'};
const clear={eligible:true,eventId:'e2',eventType:'MISSILE_ALL_CLEAR',audioAssetId:'b'};
test('plans only the two missile ALARM records, never dispatches',()=>{
 const result=planMissilePlayback([danger,clear,{eligible:true,eventId:'e3',eventType:'UAV_DANGER',audioAssetId:'c'}]);
 assert.deepEqual(result.commands.map(c=>c.action),['PLAY_DANGER','PLAY_ALL_CLEAR']);
 assert.equal(result.executionEnabled,false);
 assert.equal(result.commands.every(c=>c.speakerPlaybackEnabled===false),true);
});
test('deduplicates and excludes blocked events',()=>{
 const result=planMissilePlayback([danger,danger,clear,{...danger,eventId:'e4',eligible:false}],{alreadyHandled:new Set(['e2'])});
 assert.deepEqual(result.commands.map(c=>c.idempotencyKey),['e1']);
});
test('all clear can request interruption of active alarm without activating playback',()=>{
 const result=planMissilePlayback([clear],{alarmActive:true});
 assert.equal(result.commands[0].interruptCurrentAlarm,true);
 assert.equal(result.commands[0].mode,'DRY_RUN');
});
