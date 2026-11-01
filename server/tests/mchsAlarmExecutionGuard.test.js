import test from 'node:test';
import assert from 'node:assert/strict';
import {assessAlarmExecutionGate,transitionAlarmExecutor} from '../src/lib/mchsAlarmExecutionGuard.js';
test('real automation and missing safety conditions cannot pass gate',()=>{
 assert.equal(assessAlarmExecutionGate({mode:'AUTO',operatorHold:false,sourceHealthy:true,workerHealthy:true,
 physicalOutputIsolated:true,trainingAcknowledged:true}).allowed,false);
 assert.equal(assessAlarmExecutionGate({mode:'TRAINING',operatorHold:false,sourceHealthy:true,workerHealthy:true,
 physicalOutputIsolated:false,trainingAcknowledged:true}).allowed,false);
 assert.equal(assessAlarmExecutionGate({mode:'TRAINING',operatorHold:false,sourceHealthy:true,workerHealthy:true,
 physicalOutputIsolated:true,trainingAcknowledged:true}).allowed,true);
});
test('STOP is accepted from every state; halt prevents restart',()=>{
 for(const state of ['IDLE','DANGER_PENDING','DANGER_ACTIVE','CLEAR_PENDING'])
  assert.equal(transitionAlarmExecutor(state,'STOP').state,'HALTED');
 assert.equal(transitionAlarmExecutor('HALTED','DANGER').state,'HALTED');
 assert.equal(transitionAlarmExecutor('DANGER_ACTIVE','CLEAR').state,'CLEAR_PENDING');
});
