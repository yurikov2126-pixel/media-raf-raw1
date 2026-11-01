import test from 'node:test';
import assert from 'node:assert/strict';
import {createMissileAlarmExecutorGuard} from '../src/lib/mchsMissileAlarmExecutorGuard.js';
const danger={commandId:'danger-1',eventType:'MISSILE_DANGER',audioAssetId:'alarm-1'};
const clear={commandId:'clear-1',eventType:'MISSILE_ALL_CLEAR',audioAssetId:'alarm-2'};
test('danger then clear may only prepare; audio never changes',()=>{
 const guard=createMissileAlarmExecutorGuard();
 assert.equal(guard.decide(clear).reason,'NO_ACTIVE_DANGER');
 assert.equal(guard.decide(danger).state,'DANGER_PREPARED');
 assert.equal(guard.decide(danger).reason,'DUPLICATE_COMMAND');
 const result=guard.decide(clear);
 assert.equal(result.state,'CLEAR_PREPARED');
 assert.equal(result.automaticPlaybackEnabled,false);
 assert.equal(result.audioOutput,'UNMODIFIED');
});
test('HALT prevents further preparation until explicit test reset',()=>{
 const guard=createMissileAlarmExecutorGuard();
 assert.equal(guard.halt().state,'HALTED');
 assert.equal(guard.decide(danger).reason,'OPERATOR_HALT');
 assert.equal(guard.resetForTest().state,'IDLE');
 assert.equal(guard.decide(danger).ok,true);
});
test('reject unknown types and missing audio',()=>{
 const guard=createMissileAlarmExecutorGuard();
 assert.equal(guard.decide({...danger,eventType:'UAV_DANGER'}).reason,'TYPE_NOT_ALLOWED');
 assert.equal(guard.decide({...danger,audioAssetId:null}).reason,'INVALID_COMMAND');
});
