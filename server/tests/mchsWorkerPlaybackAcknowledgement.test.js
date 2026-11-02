import test from 'node:test';
import assert from 'node:assert/strict';
import {startAndVerifyMchsWorker,stopMchsWorkerEvent} from '../src/lib/mchsWorkerPlaybackAcknowledgement.js';
const options={assetId:'alarm-1',eventId:'event-1',eventType:'MISSILE_DANGER'};
test('START requires same active asset in Worker state',async()=>{
 let active=false;
 const request=async(action,assetId)=>{
  if(action==='START'){active=true;return {httpStatus:200,data:{ok:true}};}
  if(action==='STOP'){active=false;return {httpStatus:200,data:{ok:true}};}
  return {httpStatus:200,data:{active,assetId:active?'alarm-1':null}};
 };
 const start=await startAndVerifyMchsWorker({...options,request});
 assert.equal(start.confirmed,true);assert.equal(start.audibleOutputVerified,false);
 const stop=await stopMchsWorkerEvent({...options,request});
 assert.equal(stop.confirmed,true);
});
test('START on busy Worker does not interrupt current audio',async()=>{
 let starts=0;
 const request=async action=>{if(action==='START')starts++;return {httpStatus:200,data:{active:true,assetId:'another'}}};
 const response=await startAndVerifyMchsWorker({...options,request});
 assert.equal(response.reason,'WORKER_NOT_IDLE');assert.equal(starts,0);
});
test('wrong asset is not acknowledged and triggers verified STOP',async()=>{
 let active=false,stops=0;
 const request=async action=>{
  if(action==='START'){active=true;return {httpStatus:200,data:{ok:true}};}
  if(action==='STOP'){active=false;stops++;return {httpStatus:200,data:{ok:true}};}
  return {httpStatus:200,data:{active,assetId:'wrong'}};
 };
 const response=await startAndVerifyMchsWorker({...options,request});
 assert.equal(response.confirmed,false);assert.equal(response.stopConfirmed,true);assert.equal(stops,1);
});
test('unknown type never starts audio',async()=>{
 const response=await startAndVerifyMchsWorker({...options,eventType:'OTHER',request:async()=>{throw Error('unexpected')}});
 assert.equal(response.reason,'INVALID_START_REQUEST');
});
