import test from 'node:test';
import assert from 'node:assert/strict';
import {planMissilePlayback} from '../src/lib/mchsMissilePlaybackPlan.js';
const danger={eligible:true,eventId:'danger-1',eventType:'MISSILE_DANGER',audioAssetId:'alarm-1'};
const clear={eligible:true,eventId:'clear-1',eventType:'MISSILE_ALL_CLEAR',audioAssetId:'allclear-1'};
test('individual danger repeat count is applied only to dry-run plan',()=>{
 const r=planMissilePlayback([danger,clear],{rules:{MISSILE_DANGER:{repeats:4},MISSILE_ALL_CLEAR:{repeats:5}}});
 assert.equal(r.commands[0].repeats,4);
 assert.equal(r.commands[1].repeats,1);
 assert.ok(r.commands.every(c=>c.mode==='DRY_RUN'&&c.speakerPlaybackEnabled===false));
 assert.equal(r.executionEnabled,false);
});
test('invalid repeats default to one without authorizing playback',()=>{
 for(const value of [-1,0,10,'4',null]){
  const r=planMissilePlayback([danger],{rules:{MISSILE_DANGER:{repeats:value}}});
  assert.equal(r.commands[0].repeats,1);
 }
});
test('blocked, duplicate and missing audio decisions never become commands',()=>{
 const r=planMissilePlayback([danger,danger,{...clear,eligible:false},{...danger,eventId:'no-audio',audioAssetId:null}]);
 assert.equal(r.commands.length,1);
});
