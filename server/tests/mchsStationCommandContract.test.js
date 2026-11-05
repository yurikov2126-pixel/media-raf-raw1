import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMchsStationCommand} from '../src/lib/mchsStationCommandContract.js';
import {requestMchsStationSession} from '../src/lib/mchsStationWorkerTransport.js';

const base={action:'START',eventId:'missile_20261105_01',
 eventType:'MISSILE_DANGER',assetId:'alarm_001',repeats:2,
 occurredAt:'2026-11-05T12:00:00.000Z'};
const nowMs=Date.parse(base.occurredAt)+30000;

test('valid current danger and all clear are bounded and event bound',()=>{
 assert.equal(validateMchsStationCommand(base,{nowMs}).ok,true);
 assert.equal(validateMchsStationCommand({...base,eventType:'MISSILE_ALL_CLEAR',repeats:1},{nowMs}).ok,true);
 assert.equal(validateMchsStationCommand({action:'STOP',eventId:base.eventId}).ok,true);
 assert.equal(validateMchsStationCommand({action:'STATUS'}).ok,true);
});

test('stale, future and invalid event IDs are not admitted',()=>{
 for(const item of [
  {...base,occurredAt:'2026-11-05T11:57:00Z'},
  {...base,occurredAt:'2026-11-05T12:01:00Z'},
  {...base,eventId:'../other'},
  {...base,assetId:'../../passwd'},
  {...base,repeats:0},
  {...base,repeats:6},
  {...base,eventType:'THUNDERSTORM'},
  {...base,eventType:'MISSILE_ALL_CLEAR',repeats:2},
  {...base,occurredAt:'invalid'},
  {...base,occurredAt:null},
  {...base,action:'RESET_ALL'}
 ]){
  const result=validateMchsStationCommand(item,{nowMs});
  assert.equal(result.ok,false,JSON.stringify(item));
 }
});

test('STOP is always bound to a specific event',()=>{
 for(const id of [undefined,null,'','../../other']){
  assert.equal(validateMchsStationCommand({action:'STOP',eventId:id}).ok,false);
 }
});

test('coordinator refuses START without environment permission, even with valid event',async()=>{
 const result=await requestMchsStationSession(base,{enabled:false,
  port:4105,secret:'x'.repeat(32)});
 assert.deepEqual(result,{ok:false,reason:'COORDINATOR_DISABLED'});
});

test('invalid commands never contact Worker',async()=>{
 const result=await requestMchsStationSession({...base,eventType:'OTHER'},
  {enabled:true,port:4105,secret:'x'.repeat(32)});
 assert.equal(result.reason,'INVALID_EVENT_BINDING');
});

test('missing Worker secret refuses before opening a socket',async()=>{
 const result=await requestMchsStationSession({action:'STATUS'},
  {enabled:false,port:4105,secret:''});
 assert.equal(result.reason,'WORKER_NOT_CONFIGURED');
});
