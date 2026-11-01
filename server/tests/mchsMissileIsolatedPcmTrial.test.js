import test from 'node:test';
import assert from 'node:assert/strict';
import {runIsolatedMissileAlarmPcmTrial} from '../src/lib/mchsMissileIsolatedPcmTrial.js';
const pcm=v=>Buffer.alloc(7680,v);
test('danger then all-clear overlay returns to original program PCM',()=>{
 const result=runIsolatedMissileAlarmPcmTrial({music:pcm(17),danger:pcm(36),clear:pcm(72)});
 assert.equal(result.ok,true);
 assert.deepEqual(result.stages.map(x=>x.name),['DANGER','ALL_CLEAR']);
 assert.equal(result.resumedNormalPcm,true);
 assert.equal(result.stationEncoderTouched,false);
 assert.equal(result.executionEnabled,false);
});
test('invalid training PCM is fail closed',()=>{
 assert.equal(runIsolatedMissileAlarmPcmTrial({music:pcm(17),danger:null,clear:pcm(72)}).reason,'INVALID_PCM');
});
