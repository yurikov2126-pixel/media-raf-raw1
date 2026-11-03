import test from 'node:test';
import assert from 'node:assert/strict';
import {stageSyntheticHeadphonesCycle as stage,advanceSyntheticHeadphonesCycle as advance}
 from '../src/lib/mchsSyntheticHeadphonesCycle.js';

const now=Date.parse('2026-11-04T12:00:00Z');
const ready={fresh:true,operatorIsolationAttested:true,isolatedTrialSourceAdmission:true,
 centralPacketsConfirmed:true,
 assets:{MISSILE_DANGER:'a'.repeat(64),MISSILE_ALL_CLEAR:'b'.repeat(64)}};
const id='synthetic_'+'a'.repeat(24);
const started=stage({id,readiness:ready,nowMs:now});

test('synthetic operator rehearsal cannot start without current isolated Agent',()=>{
 assert.equal(stage({id,readiness:null,nowMs:now}).ok,false);
 assert.equal(stage({id,readiness:{...ready,centralPacketsConfirmed:false},nowMs:now}).ok,false);
 assert.equal(stage({id:'danger_123',readiness:ready,nowMs:now}).ok,false);
 assert.equal(started.ok,true);
 assert.equal(started.state.phase,'DANGER_PENDING');
});

test('danger -> complete evidence -> clear -> complete, no artificial Android or PA action',()=>{
 const d=advance(started.state,{readiness:ready,nowMs:now+50});
 assert.equal(d.command.eventType,'MISSILE_DANGER');
 assert.equal(d.command.syntheticTraining,true);
 assert.equal(d.command.officialSourceVerified,false);
 assert.equal(d.command.trialOnly,true);
 assert.equal(d.command.repeats,1);
 assert.equal(d.command.sha256,ready.assets.MISSILE_DANGER);
 const repeated=advance(d.state,{readiness:ready,nowMs:now+100});
 assert.deepEqual(repeated.command,d.command);
 const dCompleted={eventId:d.command.eventId,phase:'COMPLETE',
  naturalCompletion:true,centralReturnConfirmed:true,processRunning:false,
  completedRepeats:1,expectedRepeats:1};
 const clearPending=advance(d.state,{readiness:{...ready,centralPacketsConfirmed:false},
  observations:[dCompleted],nowMs:now+30000});
 assert.equal(clearPending.command,null);
 assert.equal(clearPending.state.phase,'CLEAR_PENDING');
 assert.equal(advance(clearPending.state,{readiness:null,nowMs:now+31000}).command,null);
 const c=advance(clearPending.state,{readiness:ready,nowMs:now+31000});
 assert.equal(c.command.eventType,'MISSILE_ALL_CLEAR');
 assert.equal(c.command.repeats,1);
 assert.ok(c.command.sequence>d.command.sequence);
 assert.equal(c.command.sha256,ready.assets.MISSILE_ALL_CLEAR);
 const cCompleted={...dCompleted,eventId:c.command.eventId};
 const done=advance(c.state,{readiness:ready,observations:[dCompleted,cCompleted],nowMs:now+32000});
 assert.equal(done.state.phase,'COMPLETE');
 assert.equal(done.command,null);
 assert.equal(advance(done.state,{readiness:ready,nowMs:now+33000}).command,null);
});

test('failed playback, missing confirmed return and duplicated staging do not advance',()=>{
 const d=advance(started.state,{readiness:ready,nowMs:now+1});
 const duplicate=stage({state:d.state,readiness:ready,id,nowMs:now+2});
 assert.equal(duplicate.reason,'CYCLE_ALREADY_ACTIVE');
 const partial=advance(d.state,{readiness:ready,nowMs:now+100,
  observations:[{eventId:d.command.eventId,phase:'COMPLETE',
   naturalCompletion:true,centralReturnConfirmed:false,processRunning:false,
   completedRepeats:1,expectedRepeats:1}]});
 assert.equal(partial.command,null);
 assert.equal(partial.state.phase,'DANGER_WAIT');
 const failed=advance(d.state,{readiness:ready,nowMs:now+100,
  observations:[{eventId:d.command.eventId,phase:'FAILED'}]});
 assert.equal(failed.state.phase,'FAILED');
 assert.equal(failed.command,null);
});

test('old Agent without trial-source admission cannot arm or dispatch',()=>{
 const old={...ready,isolatedTrialSourceAdmission:false};
 assert.equal(stage({id,readiness:old,nowMs:now}).reason,'WINDOWS_AGENT_UPDATE_REQUIRED');
 assert.equal(advance(started.state,{readiness:old,nowMs:now+1}).reason,'WINDOWS_AGENT_UPDATE_REQUIRED');
});
test('unanswered delivery expires as FAILED, never initiates all-clear',()=>{
 const d=advance(started.state,{readiness:ready,nowMs:now+1});
 const ended=advance(d.state,{readiness:ready,nowMs:now+61001});
 assert.equal(ended.state.phase,'FAILED');
 assert.equal(ended.state.failReason,'AGENT_COMPLETION_TIMEOUT');
 assert.equal(ended.command,null);
 assert.equal(stage({state:ended.state,readiness:ready,nowMs:now+62000,id}).ok,true);
});
test('no fresh Agent -> no WAV command and no replay',()=>{
 const no=advance(started.state,{readiness:{...ready,fresh:false},nowMs:now+1});
 assert.equal(no.command,null);
 assert.equal(no.state.phase,'DANGER_PENDING');
});
