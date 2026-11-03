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

test('one START per asset: five full danger repetitions, then one all-clear',async()=>{
 const starts=[],progress=[];let stage=0;
 const request=async(action,assetId,repeats)=>{
  if(action==='START'){
   starts.push({assetId,repeats});
   stage++;
   return {httpStatus:200,data:{ok:true,revision:stage*2-1}};
  }
  if(action==='STOP')throw Error('NO_MANUAL_STOP_EXPECTED');
  if(!stage)return {httpStatus:200,data:{active:false}};
  return {httpStatus:200,data:{active:false,revision:stage*2,
   lastStopReason:'FILE_COMPLETED',completedRepeats:stage===1?5:1}};
 };
 const result=await runTrainingSequence({dangerAssetId:'d',clearAssetId:'c',
  dangerRepeats:5,request,pollMs:1,maxWaitMs:500,
  onProgress:x=>progress.push(x)});
 assert.equal(result.ok,true);
 assert.deepEqual(starts,[{assetId:'d',repeats:5},{assetId:'c',repeats:1}]);
 assert.deepEqual(progress.filter(x=>x.status==='COMPLETED').map(x=>x.total),[5,1]);
});
test('incomplete playback cannot claim successful automatic return',async()=>{
 let starts=0,stops=0;
 const request=async(action)=>{
  if(action==='START'){starts++;return {httpStatus:200,data:{ok:true,revision:1}};}
  if(action==='STOP'){stops++;return {httpStatus:200,data:{ok:true}};}
  if(!starts)return {httpStatus:200,data:{active:false}};
  return {httpStatus:200,data:{active:false,revision:2,
   lastStopReason:'FILE_COMPLETED',completedRepeats:2}};
 };
 const result=await runTrainingSequence({dangerAssetId:'d',clearAssetId:'c',
  dangerRepeats:3,request,pollMs:1,maxWaitMs:150});
 assert.equal(result.ok,false);
 assert.equal(result.reason,'INCOMPLETE_REPEATS_DANGER');
 assert.equal(starts,1);
 assert.equal(stops,1);
});
test('if session changes mid-track, stop and do not play all-clear',async()=>{
 let starts=0,stops=0;
 const request=async(action)=>{
  if(action==='START'){starts++;return {httpStatus:200,data:{ok:true,revision:7}};}
  if(action==='STOP'){stops++;return {httpStatus:200,data:{ok:true}};}
  if(!starts)return {httpStatus:200,data:{active:false}};
  return {httpStatus:200,data:{active:true,revision:17,completedRepeats:0}};
 };
 const result=await runTrainingSequence({dangerAssetId:'d',clearAssetId:'c',
  request,pollMs:1,maxWaitMs:150});
 assert.equal(result.ok,false);
 assert.equal(result.reason,'WORKER_SESSION_CHANGED_DANGER');
 assert.equal(starts,1);
 assert.equal(stops,1);
});
