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
   starts++;active=true;assetId=id;repeats=count;completedRepeats=0;
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
