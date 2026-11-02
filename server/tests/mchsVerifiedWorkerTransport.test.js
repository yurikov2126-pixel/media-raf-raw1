import test from 'node:test';
import assert from 'node:assert/strict';
import {createMchsVerifiedWorkerTransport} from '../src/lib/mchsVerifiedWorkerTransport.js';
const spec={eventId:'event-1',eventType:'MISSILE_DANGER',assetId:'alarm-1',
 repeats:2,publicStreamAllowed:false,amplifierAllowed:false};
function fakeWorker(){
 let active=false,assetId=null,stopReason='FILE_COMPLETED',starts=0;
 const request=async(action,id)=>{
  if(action==='START'){starts++;active=true;assetId=id;return {httpStatus:200,data:{ok:true}};}
  if(action==='STOP'){active=false;stopReason='OPERATOR_STOP';return {httpStatus:200,data:{ok:true}};}
  const value={httpStatus:200,data:{active,assetId,lastStopReason:stopReason}};
  if(active){active=false;stopReason='FILE_COMPLETED';}
  return value;
 };
 return {request,getStarts:()=>starts};
}
test('no real Worker action when public output isolation is unverified',async()=>{
 let called=false;
 const a=createMchsVerifiedWorkerTransport({request:async()=>{called=true;}});
 assert.equal((await a.start(spec)).reason,'OUTPUT_ISOLATION_NOT_VERIFIED');
 assert.equal(called,false);
});
test('real request transport sends START and confirms STOP',async()=>{
 const x=fakeWorker();
 const a=createMchsVerifiedWorkerTransport({request:x.request,isolatedOutputVerified:true,sleep:async()=>{}});
 // Keep active until the immediate post-start state probe completes.
 let active=false,count=0;
 const request=async(action,id)=>{
  if(action==='START'){active=true;count++;return {httpStatus:200,data:{ok:true}};}
  if(action==='STOP'){active=false;return {httpStatus:200,data:{ok:true}};}
  return {httpStatus:200,data:{active,assetId:idForState,lastStopReason:'FILE_COMPLETED'}};
 };
 const idForState=spec.assetId;
 const adapter=createMchsVerifiedWorkerTransport({request,isolatedOutputVerified:true,
  sleep:async()=>{active=false;},pollMs:1});
 const started=await adapter.start(spec);assert.equal(started.confirmed,true);
 const result=await adapter.waitUntilCompleted(spec);
 assert.equal(result.completed,true);assert.equal(count,2);
 const stopped=await adapter.stop(spec);assert.equal(stopped.confirmed,true);
 assert.equal(stopped.playbackState,'STOPPED');
 assert.equal(typeof a.stop,'function');
});
test('all clear cannot repeat',async()=>{
 const a=createMchsVerifiedWorkerTransport({request:async()=>{throw Error('unexpected');},isolatedOutputVerified:true});
 assert.equal((await a.start({...spec,eventType:'MISSILE_ALL_CLEAR'})).reason,'INVALID_SESSION');
});
