import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMchsTypeRepeats,validateMchsTypeRepeats,buildMchsTypeAudioPreview} from '../src/lib/mchsTypeAudioPlan.js';
test('per-type repeats must be integer 1 through 5',()=>{
 for(const n of [1,2,3,4,5])assert.equal(validateMchsTypeRepeats(n),true);
 for(const n of [0,6,2.5,'3',null,-1])assert.equal(validateMchsTypeRepeats(n),false);
 assert.equal(normalizeMchsTypeRepeats(undefined),1);
});
test('preview derives total length but never authorizes playback',()=>{
 const result=buildMchsTypeAudioPreview({audioAssetId:'alarm1',repeats:3},
 {id:'alarm1',name:'Тревога',durationMs:12000});
 assert.equal(result.expectedDurationMs,36000);
 assert.equal(result.repeats,3);
 assert.equal(result.executable,false);
 assert.equal(result.automaticPlaybackEnabled,false);
});
test('missing audio cannot be considered configured',()=>{
 const r=buildMchsTypeAudioPreview({audioAssetId:'deleted',repeats:5},null);
 assert.equal(r.configured,false);
 assert.equal(r.expectedDurationMs,null);
});
