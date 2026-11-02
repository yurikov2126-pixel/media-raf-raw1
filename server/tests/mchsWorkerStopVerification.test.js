import test from 'node:test';import assert from 'node:assert/strict';
import {stopAndVerifyMchsWorker} from '../src/lib/mchsWorkerStopVerification.js';
test('STOP confirmation requires inactive overlay status',async()=>{
 let active=true;
 const result=await stopAndVerifyMchsWorker({request:async action=>{
  if(action==='STOP'){active=false;return {httpStatus:200,data:{ok:true}};}
  return {httpStatus:200,data:{active}};
 }});
 assert.equal(result.confirmed,true);
});
test('HTTP STOP success alone never proves stop',async()=>{
 const result=await stopAndVerifyMchsWorker({attempts:2,request:async action=>action==='STOP'?
  {httpStatus:200,data:{ok:true}}:{httpStatus:200,data:{active:true}}});
 assert.equal(result.confirmed,false);assert.equal(result.attempts,2);
});
test('connection failure stays unconfirmed',async()=>{
 const result=await stopAndVerifyMchsWorker({request:async()=>{throw Error('OFFLINE');}});
 assert.equal(result.confirmed,false);assert.equal(result.reason,'WORKER_UNREACHABLE');
});
