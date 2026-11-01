import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDangerRepeats,validateDangerRepeats,planAlarmSequence} from '../src/lib/mchsAlarmRepeats.js';
test('default and invalid count safely resolve to one',()=>{
 assert.equal(normalizeDangerRepeats(undefined),1);
 for(const n of [0,-1,6,1.5,'3',null])assert.equal(validateDangerRepeats(n),false);
 for(let n=1;n<=5;n++)assert.equal(validateDangerRepeats(n),true);
});
test('danger repeats specified times; all clear strictly once',()=>{
 const steps=planAlarmSequence({dangerAssetId:'danger',clearAssetId:'clear',dangerRepeats:3});
 assert.deepEqual(steps.map(s=>s.assetId),['danger','danger','danger','clear']);
 assert.deepEqual(steps.map(s=>s.stage),['DANGER','DANGER','DANGER','ALL_CLEAR']);
 assert.equal(steps[2].repetition,3);
 assert.equal(steps[3].total,1);
});
