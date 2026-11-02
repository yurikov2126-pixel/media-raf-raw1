import test from 'node:test';
import assert from 'node:assert/strict';
import {executeMchsControlledAcceptance} from '../src/lib/mchsControlledAcceptance.js';
const at=Date.parse('2026-11-03T12:00:00Z');
const event={id:'evt-1',sourceEventId:'android-1',source:'MCHS_ANDROID',
 verified:true,region:'Тульская область',title:'Ракетная опасность',body:'',
 occurredAt:new Date(at-1000).toISOString()};
const rules={MISSILE_DANGER:{mode:'REVIEW',audioAssetId:'alarm',repeats:2}};
const args={event,rules,checkpoint:{state:'CLEAR'},sourceOfficiallyVerified:true,
 operatorHold:false,authorization:{approved:true,mode:'ISOLATED_TRIAL',
 publicStreamAllowed:false,amplifierAllowed:false},now:()=>at};
test('authentic Android alert is denied if completion-capable Agent missing',async()=>{
 const result=await executeMchsControlledAcceptance({...args,
  worker:{start(){},stop(){},waitUntilCompleted(){}},agent:{start(){},stop(){}}});
 assert.equal(result.reason,'INCOMPLETE_CHANNEL_TRANSPORT');
 assert.equal(result.executionEnabled,false);
});
test('operator hold, wrong region, unverified source and duplicate are denied before sound',async()=>{
 for(const patch of [{operatorHold:true},{sourceOfficiallyVerified:false},
 {event:{...event,region:'Московская область'}},{seenIds:new Set(['android-1'])}]){
  const result=await executeMchsControlledAcceptance({...args,...patch});
  assert.equal(result.ok,false);assert.equal(result.executionEnabled,false);
 }
});
test('public output authorization cannot be used for controlled acceptance',async()=>{
 const result=await executeMchsControlledAcceptance({...args,
  authorization:{...args.authorization,publicStreamAllowed:true}});
 assert.equal(result.reason,'TRIAL_AUTHORIZATION_REQUIRED');
});
test('no all-clear before danger',async()=>{
 const result=await executeMchsControlledAcceptance({...args,checkpoint:{state:'UNKNOWN'}});
 assert.equal(result.reason,'UNKNOWN_STATE');
});
