import test from 'node:test';
import assert from 'node:assert/strict';
import {planMissileAlarmTransition} from '../src/lib/mchsMissileAlarmTransition.js';
const danger={eventId:'event-danger',eventType:'MISSILE_DANGER',audioAssetId:'alarm-a',status:'ACKED_DRY_RUN'};
const clear={eventId:'event-clear',eventType:'MISSILE_ALL_CLEAR',audioAssetId:'alarm-b',status:'ACKED_DRY_RUN'};
test('operator hold prevents every automatic transition',()=>{
 assert.equal(planMissileAlarmTransition({state:'CLEAR',command:danger}).reason,'OPERATOR_HOLD');
});
test('danger can be proposed only from known clear state',()=>{
 const result=planMissileAlarmTransition({state:'CLEAR',command:danger,operatorHold:false});
 assert.equal(result.action,'PREPARE_DANGER');
 assert.equal(result.executionEnabled,false);
 assert.equal(planMissileAlarmTransition({state:'DANGER',command:danger,operatorHold:false}).reason,'DANGER_ALREADY_ACTIVE');
 assert.equal(planMissileAlarmTransition({state:'UNKNOWN',command:danger,operatorHold:false}).reason,'UNKNOWN_STATE');
});
test('all clear requires active danger and restores schedule authority',()=>{
 const result=planMissileAlarmTransition({state:'DANGER',command:clear,activeEventId:'event-danger',operatorHold:false});
 assert.equal(result.action,'PREPARE_ALL_CLEAR');
 assert.equal(result.nextState,'CLEAR');
 assert.equal(result.resumePolicy,'NEXT_SCHEDULE_AUTHORITY');
 assert.equal(result.executionEnabled,false);
 assert.equal(planMissileAlarmTransition({state:'CLEAR',command:clear,operatorHold:false}).reason,'NO_ACTIVE_DANGER');
});
test('unconfirmed, malformed and unapproved event types always blocked',()=>{
 assert.equal(planMissileAlarmTransition({state:'CLEAR',command:{...danger,status:'STAGED'},operatorHold:false}).reason,'NO_CONFIRMED_INTENT');
 assert.equal(planMissileAlarmTransition({state:'CLEAR',command:{...danger,eventType:'UAV_DANGER'},operatorHold:false}).reason,'INVALID_TYPE');
});
