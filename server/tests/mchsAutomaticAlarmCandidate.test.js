import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyAutomaticAlarmCandidate} from '../src/lib/mchsAutomaticAlarmCandidate.js';
const now=Date.parse('2026-11-01T20:00:00Z');
const valid={id:'e1',source:'MCHS_ANDROID',sourceEventId:'message-1',title:'Ракетная опасность',body:'Объявлена ракетная опасность',region:'Тульская область',occurredAt:new Date(now-10000).toISOString(),verified:true};
test('verified mobile notice still cannot authorize automatic audio',()=>{
 const r=classifyAutomaticAlarmCandidate(valid,{nowMs:now});
 assert.equal(r.accepted,true);assert.equal(r.action,'REVIEW_ONLY');
 assert.equal(r.officialSourceVerified,false);assert.equal(r.executionEnabled,false);
});
test('stale, wrong-region, and unapproved event types are rejected',()=>{
 assert.equal(classifyAutomaticAlarmCandidate({...valid,region:'Москва'},{nowMs:now}).reason,'REGION_MISMATCH');
 assert.equal(classifyAutomaticAlarmCandidate({...valid,occurredAt:new Date(now-250000).toISOString()},{nowMs:now}).reason,'STALE_OR_UNKNOWN_TIMESTAMP');
 assert.equal(classifyAutomaticAlarmCandidate({...valid,title:'Дождь',body:'Осадки'},{nowMs:now}).accepted,false);
});
