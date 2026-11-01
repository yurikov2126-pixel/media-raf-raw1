import test from 'node:test';
import assert from 'node:assert/strict';
import {runTrainingSequence} from '../src/lib/mchsTrainingSequence.js';
test('reject duplicate selected ALARM assets',async()=>{const x=await runTrainingSequence({dangerAssetId:'same',clearAssetId:'same',request:async()=>{throw Error('unexpected');}});assert.equal(x.reason,'INVALID_TRAINING_ASSETS');});
test('does not interrupt a busy Worker',async()=>{const x=await runTrainingSequence({dangerAssetId:'a',clearAssetId:'b',request:async()=>({httpStatus:200,data:{active:true}})});assert.equal(x.reason,'WORKER_BUSY');});

test('transient worker status outage does not stop the currently playing ALARM',async()=>{
 const stages=[];let requests=0,stops=0;
 const request=async(action)=>{
  if(action==='START')return {httpStatus:200,data:{ok:true}};
  if(action==='STOP'){stops++;return {httpStatus:200,data:{ok:true}};}
  requests++;
  if(requests===2||requests===4)throw new Error('WORKER_TIMEOUT');
  return {httpStatus:200,data:{active:false,lastStopReason:'FILE_COMPLETED'}};
 };
 const result=await runTrainingSequence({dangerAssetId:'danger',clearAssetId:'clear',request,
  pollMs:1,maxWaitMs:500,onProgress:x=>stages.push(x)});
 assert.equal(result.ok,true);
 assert.equal(stops,0);
 assert.equal(stages.some(x=>x.status==='RETRYING_WORKER_STATUS'),true);
});
