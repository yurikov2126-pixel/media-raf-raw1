import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMchsAgentReadiness as normalize,readMchsAgentReadiness as read}
 from '../src/lib/mchsAgentIsolatedReadiness.js';

const now=Date.parse('2026-11-04T12:00:00Z');
const body={version:1,mode:'ISOLATED_EVENT_AUDIO',operatorIsolationAttested:true,
 centralPacketsConfirmed:true,isolatedTrialSourceAdmission:true,assets:{
 MISSILE_DANGER:'a'.repeat(64),MISSILE_ALL_CLEAR:'b'.repeat(64)}};
test('valid headphones heartbeat remains non-actuating and cannot verify physical PA',()=>{
 const result=normalize(body);
 assert.equal(result.ok,true);
 assert.equal(result.value.physicalPaVerified,false);
 assert.equal(result.value.publicPlaybackAuthorized,false);
 assert.equal(result.value.isolatedTrialSourceAdmission,true);
 assert.equal(normalize({...body,isolatedTrialSourceAdmission:undefined}).value.isolatedTrialSourceAdmission,false);
 const saved={...result.value,receivedAt:new Date(now-1000).toISOString()};
 assert.equal(read(saved,{nowMs:now}).fresh,true);
 assert.equal(read(saved,{nowMs:now}).physicalPaVerified,false);
});
test('stale or future heartbeat cannot support current diagnostics',()=>{
 const saved={...body,receivedAt:new Date(now-31000).toISOString()};
 assert.equal(read(saved,{nowMs:now}),null);
 assert.equal(read({...saved,receivedAt:new Date(now+1).toISOString()},{nowMs:now}),null);
});
test('digest mismatch and unconfirmed operator consent are rejected',()=>{
 for(const patch of [
  {assets:{...body.assets,MISSILE_DANGER:'bad'}},
  {assets:{...body.assets,MISSILE_ALL_CLEAR:body.assets.MISSILE_DANGER}},
  {operatorIsolationAttested:false},{mode:'PUBLIC_BROADCAST'},
  {centralPacketsConfirmed:'true'}
 ]){
  assert.equal(normalize({...body,...patch}).ok,false);
 }
});
