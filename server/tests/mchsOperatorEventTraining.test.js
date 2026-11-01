import test from 'node:test';
import assert from 'node:assert/strict';
import {assessOperatorTrainingEvent} from '../src/lib/mchsOperatorEventTraining.js';
const now=Date.parse('2026-11-02T01:00:00Z');
const event={source:'MCHS_ANDROID',verified:true,title:'Ракетная опасность',body:'Тульская область',
 region:'Тульская область',occurredAt:new Date(now-10000).toISOString()};
test('eligible recent event does not itself start any sound',()=>{
 const result=assessOperatorTrainingEvent(event,{nowMs:now});
 assert.equal(result.allowed,true);
 assert.deepEqual(Object.keys(result).sort(),['allowed','reason','type']);
});
test('reject unverified, off-region, stale and all-clear as danger references',()=>{
 assert.equal(assessOperatorTrainingEvent({...event,verified:false},{nowMs:now}).allowed,false);
 assert.equal(assessOperatorTrainingEvent({...event,region:'Москва'},{nowMs:now}).allowed,false);
 assert.equal(assessOperatorTrainingEvent({...event,title:'Отбой ракетной опасности'},{nowMs:now}).allowed,false);
 assert.equal(assessOperatorTrainingEvent({...event,occurredAt:new Date(now-200000).toISOString()},{nowMs:now}).allowed,false);
});
