import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceIsolatedAndroidAutoFeed as advance} from '../src/lib/mchsIsolatedAndroidAutoFeed.js';
const t=Date.parse('2026-11-04T12:00:00Z');
const readiness={fresh:true,operatorIsolationAttested:true,centralPacketsConfirmed:true,
 assets:{MISSILE_DANGER:'a'.repeat(64),MISSILE_ALL_CLEAR:'b'.repeat(64)}};
const danger={id:'danger_1',sourceEventId:'android:danger',source:'MCHS_ANDROID',
 title:'Ракетная опасность',body:'',region:'Тульская область',channelId:'mchs-tula',
 occurredAt:new Date(t-1000).toISOString(),verified:false};
const clear={...danger,id:'clear_1',sourceEventId:'android:clear',
 title:'Отбой ракетной опасности',occurredAt:new Date(t-500).toISOString()};
const props={readiness,allowedChannels:['mchs-tula'],dangerRepeats:3,nowMs:t};
test('signed Android source channel can queue isolated danger, not pretend officially verified',()=>{
 const r=advance(null,{...props,events:[danger]});
 assert.equal(r.command.eventType,'MISSILE_DANGER');
 assert.equal(r.command.repeats,3);
 assert.equal(r.command.trialOnly,true);
 assert.equal(r.command.trialSourceAccepted,true);
 assert.equal(r.command.officialSourceVerified,false);
 assert.equal(r.state.phase,'DANGER');
});
test('repeated poll keeps identical sequence; never queues the same Android source twice',()=>{
 const first=advance(null,{...props,events:[danger]});
 const again=advance(first.state,{...props,events:[danger],nowMs:t+1000});
 assert.deepEqual(again.command,first.command);
 const complete={eventId:danger.id,phase:'COMPLETE',naturalCompletion:true,
  centralReturnConfirmed:true,processRunning:false,completedRepeats:3,expectedRepeats:3};
 const next=advance(first.state,{...props,events:[danger],observations:[complete],nowMs:t+1500});
 assert.equal(next.command,null);
 assert.equal(next.state.active,null);
 assert.equal(next.state.sequence,1);
});
test('all-clear must follow completed danger and always plays once',()=>{
 assert.equal(advance(null,{...props,events:[clear]}).command,null);
 const first=advance(null,{...props,events:[danger]});
 const complete={eventId:danger.id,phase:'COMPLETE',naturalCompletion:true,
  centralReturnConfirmed:true,processRunning:false,completedRepeats:3,expectedRepeats:3};
 const next=advance(first.state,{...props,events:[clear,danger],
  observations:[complete],nowMs:t+2000});
 assert.equal(next.command.eventType,'MISSILE_ALL_CLEAR');
 assert.equal(next.command.repeats,1);
 assert.equal(next.state.phase,'CLEAR');
 assert.equal(next.command.sequence,2);
 const other=advance(next.state,{...props,events:[clear],nowMs:t+3000});
 assert.equal(other.command.sequence,2);
});
test('failed playback cannot be represented as successful return',()=>{
 const first=advance(null,{...props,events:[danger]});
 const failed=advance(first.state,{...props,events:[clear],
  observations:[{eventId:danger.id,phase:'FAILED'}],nowMs:t+1000});
 assert.equal(failed.command,null);
 assert.equal(failed.reason,'PRIOR_LOCAL_AUDIO_FAILED');
});
test('rejects missing readiness, wrong region/channel, stale event and unknown event',()=>{
 for(const change of [
  {readiness:null},{allowedChannels:[]},
  {events:[{...danger,region:'Другая область'}]},
  {events:[{...danger,channelId:'other'}]},
  {events:[{...danger,occurredAt:new Date(t-140000).toISOString()}]},
  {events:[{...danger,title:'Новости колледжа'}]}
 ]){
  const r=advance(null,{...props,events:[danger],...change});
  assert.equal(r.command,null);
 }
});
test('all-clear cannot run with unconfirmed central return or truncated playback',()=>{
 const first=advance(null,{...props,events:[danger]});
 const interrupted={eventId:danger.id,phase:'COMPLETE',naturalCompletion:true,
  centralReturnConfirmed:false,processRunning:false,completedRepeats:2,expectedRepeats:3};
 const r=advance(first.state,{...props,events:[clear],observations:[interrupted],nowMs:t+11000});
 assert.equal(r.command,null);
 assert.equal(r.reason,'AWAITING_LOCAL_COMPLETION');
});

test('temporary loss of central heartbeat during a locally running WAV does not impose HALT',()=>{
 const first=advance(null,{...props,events:[danger]});
 const paused=advance(first.state,{...props,events:[clear],readiness:{
  ...readiness,centralPacketsConfirmed:false},nowMs:t+3000});
 assert.equal(paused.reason,'AWAITING_LOCAL_COMPLETION');
 assert.equal(paused.command,null);
 assert.equal(paused.state.active.command.eventId,danger.id);
});
