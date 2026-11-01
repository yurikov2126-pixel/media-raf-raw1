import test from 'node:test';
import assert from 'node:assert/strict';
import {runTrainingSequence} from '../src/lib/mchsTrainingSequence.js';
test('reject duplicate selected ALARM assets',async()=>{const x=await runTrainingSequence({dangerAssetId:'same',clearAssetId:'same',request:async()=>{throw Error('unexpected');}});assert.equal(x.reason,'INVALID_TRAINING_ASSETS');});
test('does not interrupt a busy Worker',async()=>{const x=await runTrainingSequence({dangerAssetId:'a',clearAssetId:'b',request:async()=>({httpStatus:200,data:{active:true}})});assert.equal(x.reason,'WORKER_BUSY');});
