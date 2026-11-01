import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsRecoveryPreflight} from '../src/lib/mchsRecoveryPreflight.js';
test('training completion cannot imply automatic production readiness',()=>{
 const v=assessMchsRecoveryPreflight({journal:{state:'IDLE'},worker:{reachable:true,trainingActive:false},android:{connected:true},agentVerified:false});
 assert.equal(v.readyForAutomaticExecution,false);
 assert.deepEqual(v.holds,['WINDOWS_AGENT_NOT_TESTED']);
});
test('unknown worker and interrupted journal produce review holds',()=>{
 const v=assessMchsRecoveryPreflight({journal:{state:'INTERRUPTED'}});
 assert.equal(v.operatorReviewRequired,true);
 assert.ok(v.holds.includes('WORKER_UNREACHABLE'));
 assert.ok(v.holds.includes('OPERATOR_REVIEW_REQUIRED'));
});
