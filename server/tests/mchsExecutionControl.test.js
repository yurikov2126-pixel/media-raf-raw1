import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMchsExecutionPolicy,assessMchsExecutionReadiness} from '../src/lib/mchsExecutionControl.js';
test('operator hold and auto execution remain locked even if stored config requests enable',()=>{
 const policy=normalizeMchsExecutionPolicy({operatorHold:false,requestedMode:'ENABLED',reason:'override'});
 assert.equal(policy.operatorHold,true);
 assert.equal(policy.requestedMode,'DISABLED');
});
test('readiness reports queue and missing official source; cannot authorize playback',()=>{
 const result=assessMchsExecutionReadiness({
  policy:{operatorHold:false,requestedMode:'ENABLED'},
  checkpoint:{state:'DANGER'},sourceOfficiallyVerified:true,workerAvailable:true,
  intents:[{status:'STAGED'},{status:'EXPIRED'}]
 });
 assert.equal(result.eligibleForAutomaticPlayback,false);
 assert.equal(result.executionEnabled,false);
 assert.equal(result.sourceOfficiallyVerified,false);
 assert.equal(result.queue.staged,1);
 assert.equal(result.queue.expired,1);
 assert.ok(result.holds.includes('AUTOMATIC_EXECUTION_NOT_IMPLEMENTED'));
});
test('unknown checkpoint also fails closed',()=>{
 const result=assessMchsExecutionReadiness({checkpoint:{state:'UNKNOWN'}});
 assert.ok(result.holds.includes('STATE_UNKNOWN'));
});
