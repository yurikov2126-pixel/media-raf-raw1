import test from 'node:test';
import assert from 'node:assert/strict';
import {createMchsVerifiedWorkerTransport} from '../src/lib/mchsVerifiedWorkerTransport.js';
const spec={eventId:'event-1',eventType:'MISSILE_DANGER',assetId:'alarm-1',
 repeats:3,publicStreamAllowed:false,amplifierAllowed:false};

function fakeWorker({complete=true,wrongRevision=false,shortRepeats=false,
 stopFails=false}={}){
 let active=false,assetId=null,repeats=0,completedRepeats=0,revision=4;
 let starts=0,stops=0,polls=0;
 const request=async(action,id,count)=>{
  if(action==='START'){
   starts++;active=true;assetId=id;repeats=count;completedRepeats=0;polls=0;
   revision++;return {httpStatus:200,data:{ok:true,revision}};
  }
  if(action==='STOP'){
   stops++;
   if(!stopFails){active=false;revision++;}
   return {httpStatus:200,data:{ok:true}};
  }
  polls++;
  if(active&&polls>=3&&complete){
   active=false;revision++;completedRepeats=shortRepeats?repeats-1:repeats;
  }
  return {httpStatus:200,data:{
   active,assetId,repeats,completedRepeats,
   revision:wrongRevision?revision+30:revision,
   lastStopReason:active?null:'FILE_COMPLETED'
  }};
 };
 return {request,getStarts:()=>starts,getStops:()=>stops};
}
test('never starts a Worker if its shared station output is unverified',async()=>{
 let called=false;
 const a=createMchsVerifiedWorkerTransport({request:async()=>{called=true;}});
 assert.equal((await a.start(spec)).reason,'OUTPUT_ISOLATION_NOT_VERIFIED');
 assert.equal(called,false);
});
test('one START plays all three repeats and naturally releases the session',async()=>{
 const x=fakeWorker();
 const a=createMchsVerifiedWorkerTransport({request:x.request,
  isolatedOutputVerified:true,sleep:async()=>{},pollMs:1});
 assert.equal((await a.start(spec)).confirmed,true);
 const result=await a.waitUntilCompleted(spec);
 assert.equal(result.completed,true);
 assert.equal(result.repeats,3);
 assert.equal(result.reason,'FILE_COMPLETED');
 assert.equal(x.getStarts(),1);
 assert.equal(x.getStops(),0);
 // A separate new event can start after complete natural playback.
 assert.equal((await a.start({...spec,eventId:'event-2',repeats:1})).confirmed,true);
 assert.equal(x.getStarts(),2);
});
test('all-clear always one repeat, never three',async()=>{
 const x=fakeWorker();
 const a=createMchsVerifiedWorkerTransport({request:x.request,isolatedOutputVerified:true});
 assert.equal((await a.start({...spec,eventType:'MISSILE_ALL_CLEAR'})).reason,'INVALID_SESSION');
 assert.equal(x.getStarts(),0);
 const clear={...spec,eventId:'clear',eventType:'MISSILE_ALL_CLEAR',repeats:1};
 assert.equal((await a.start(clear)).confirmed,true);
 assert.equal((await a.waitUntilCompleted(clear)).completed,true);
});
test('partial file playback is not completion and session remains locked',async()=>{
 const x=fakeWorker({shortRepeats:true});
 const a=createMchsVerifiedWorkerTransport({request:x.request,
  isolatedOutputVerified:true,sleep:async()=>{},pollMs:1});
 assert.equal((await a.start(spec)).confirmed,true);
 const result=await a.waitUntilCompleted(spec);
 assert.equal(result.completed,false);
 assert.equal(result.reason,'INCOMPLETE_OR_FOREIGN_SESSION');
 assert.equal((await a.start({...spec,eventId:'next'})).reason,'SESSION_ALREADY_RUNNING');
 assert.equal(x.getStarts(),1);
 assert.equal((await a.stop(spec)).confirmed,true);
 assert.equal(x.getStops(),1);
});
test('worker revision drift is rejected, never reported as natural completion',async()=>{
 const x=fakeWorker({wrongRevision:true});
 const a=createMchsVerifiedWorkerTransport({request:x.request,
  isolatedOutputVerified:true,sleep:async()=>{},pollMs:1});
 const result=await a.start(spec);
 assert.equal(result.reason,'START_UNCONFIRMED');
 assert.equal(x.getStops(),1);
});
test('STOP verifies Worker silence, not merely command response',async()=>{
 const x=fakeWorker({stopFails:true,complete:false});
 const a=createMchsVerifiedWorkerTransport({request:x.request,
  isolatedOutputVerified:true,sleep:async()=>{},pollMs:1});
 assert.equal((await a.start(spec)).confirmed,true);
 assert.equal((await a.stop(spec)).confirmed,false);
 assert.equal((await a.start({...spec,eventId:'next'})).reason,'SESSION_ALREADY_RUNNING');
 assert.equal(x.getStops(),3);
});
test('session-mismatched completion request cannot consume another event',async()=>{
 const x=fakeWorker();
 const a=createMchsVerifiedWorkerTransport({request:x.request,
  isolatedOutputVerified:true,sleep:async()=>{},pollMs:1});
 assert.equal((await a.start(spec)).confirmed,true);
 assert.equal((await a.waitUntilCompleted({...spec,eventId:'other'})).reason,'SESSION_MISMATCH');
 assert.equal((await a.waitUntilCompleted(spec)).completed,true);
});

test('malformed START acknowledgement triggers verified STOP instead of replay',async()=>{
 let active=false,stops=0,starts=0;
 const request=async action=>{
  if(action==='START'){
   starts++;active=true;return {httpStatus:200,data:{ok:true}};
  }
  if(action==='STOP'){
   stops++;active=false;return {httpStatus:200,data:{ok:true}};
  }
  return {httpStatus:200,data:{active,revision:2,
   lastStopReason:active?null:'OPERATOR_STOP'}};
 };
 const a=createMchsVerifiedWorkerTransport({request,isolatedOutputVerified:true});
 assert.equal((await a.start(spec)).reason,'START_REVISION_MISSING');
 assert.equal(starts,1);
 assert.equal(stops,1);
 assert.equal(active,false);
});

test('unknown START status and failed STOP do not permit a second event',async()=>{
 let active=false,starts=0;
 const request=async action=>{
  if(action==='START'){active=true;starts++;return {httpStatus:200,data:{ok:true}};}
  if(action==='STOP')return {httpStatus:200,data:{ok:true}};
  return {httpStatus:200,data:{active,revision:10}};
 };
 const a=createMchsVerifiedWorkerTransport({request,isolatedOutputVerified:true});
 assert.equal((await a.start(spec)).reason,'START_UNCERTAIN_STOP_UNCONFIRMED');
 assert.equal((await a.start({...spec,eventId:'next'})).reason,'SESSION_ALREADY_RUNNING');
 assert.equal(starts,1);
 assert.equal((await a.stop(spec)).confirmed,false);
});


test('bound trial sends identity once and verifies actual Worker completion receipt',async()=>{
 const event={...spec,eventId:'bound-1',repeats:3};
 let active=false,seen=0,starts=0,binding=null;
 const request=async(action,assetId,repeats,meta)=>{
  if(action==='START'){
   starts++;active=true;binding=meta;return {httpStatus:200,data:{ok:true,revision:21}};
  }
  if(action==='STOP'){active=false;return {httpStatus:200,data:{ok:true}};}
  if(!active)return {httpStatus:200,data:{active:false,revision:20}};
  seen++;
  if(seen===1)return {httpStatus:200,data:{active:true,revision:21,
   repeats:3,assetId:event.assetId,trainingEvent:{eventId:event.eventId,
    eventType:event.eventType,startRevision:21}}};
  return {httpStatus:200,data:{active:false,revision:22,repeats:3,completedRepeats:3,
   lastStopReason:'FILE_COMPLETED',lastTrainingEvent:{eventId:event.eventId,
    eventType:event.eventType,assetId:event.assetId,startRevision:21,
    revision:22,trialOnly:true,naturalCompletion:true}}};
 };
 const adapter=createMchsVerifiedWorkerTransport({
  request,isolatedOutputVerified:true,eventBindingRequired:true,
  sleep:async()=>{},pollMs:1});
 assert.equal((await adapter.start(event)).confirmed,true);
 assert.deepEqual(binding,{eventId:event.eventId,eventType:event.eventType,trialOnly:true});
 assert.equal((await adapter.waitUntilCompleted(event)).completed,true);
 assert.equal(starts,1);
});
test('unbound shared Worker completion never satisfies strict event receipt',async()=>{
 const event={...spec,eventId:'bound-2',repeats:2};
 let active=false;
 const request=async(action)=>{
  if(action==='START'){active=true;return {httpStatus:200,data:{ok:true,revision:10}};}
  if(action==='STOP'){active=false;return {httpStatus:200,data:{ok:true}};}
  return {httpStatus:200,data:{active,revision:active?10:9,
   assetId:event.assetId,repeats:2,completedRepeats:0}};
 };
 const adapter=createMchsVerifiedWorkerTransport({
  request,isolatedOutputVerified:true,eventBindingRequired:true});
 assert.equal((await adapter.start(event)).reason,'START_UNCONFIRMED');
});
