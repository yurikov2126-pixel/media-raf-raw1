import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareMchsBoundExecution} from '../src/lib/mchsBoundExecutionPreflight.js';
const now=Date.parse('2026-11-03T12:00:00Z');
const bytes=Buffer.from('test audio bytes');
const sha256=createHash('sha256').update(bytes).digest('hex');
const observation={id:'evt-1',sourceEventId:'src-1',source:'MCHS_ANDROID',
 verified:true,region:'Тульская область',title:'Ракетная опасность',
 body:'Ракетная опасность',occurredAt:new Date(now-1000).toISOString()};
const rules={MISSILE_DANGER:{mode:'REVIEW',audioAssetId:'alarm',repeats:2}};
const asset={id:'alarm',eventType:'MISSILE_DANGER',sha256};
const channel={eventId:'evt-1',assetId:'alarm',sha256,repeats:2};
const base={observation,checkpoint:{state:'CLEAR'},rules,asset,bytes,
 workerAsset:channel,agentAsset:channel,officialSourceVerified:true,nowMs:now};
test('verified Android event, correct ALARM bytes and both channels pass preflight only',()=>{
 const result=prepareMchsBoundExecution(base);
 assert.equal(result.ready,true);assert.equal(result.binding.sha256,sha256);
 assert.equal(result.command,null);assert.equal(result.publicPlaybackAuthorized,false);
});
test('untrusted or replayed Android event cannot reach an audio command',()=>{
 for(const patch of [{officialSourceVerified:false},{seenIds:new Set(['src-1'])},
  {observation:{...observation,region:'Другой регион'}}]){
  const result=prepareMchsBoundExecution({...base,...patch});
  assert.equal(result.ready,false);assert.equal(result.command,null);
 }
});
test('corrupt audio or mismatched Agent asset rejects START preflight',()=>{
 for(const patch of [{bytes:Buffer.from('corrupt')},
  {agentAsset:{...channel,sha256:'0'.repeat(64)}}]){
  const result=prepareMchsBoundExecution({...base,...patch});
  assert.equal(result.ready,false);assert.equal(result.publicPlaybackAuthorized,false);
 }
});
