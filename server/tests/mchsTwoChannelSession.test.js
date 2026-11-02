import test from 'node:test';import assert from 'node:assert/strict';
import {assessMchsTwoChannelSession} from '../src/lib/mchsTwoChannelSession.js';
const now=Date.parse('2026-11-02T17:00:00Z');
const event={id:'e1',eventType:'MISSILE_DANGER'};
const ack=(action)=>({mode:'EVENT_SCOPED_PLAYBACK',eventId:'e1',eventType:'MISSILE_DANGER',
 action,confirmed:true,receiptOnly:false,playbackState:action==='START'?'ACTIVE':'STOPPED',
 confirmedAt:'2026-11-02T16:59:59Z'});
const good={event,workerStart:ack('START'),agentStart:ack('START'),
 workerStop:ack('STOP'),agentStop:ack('STOP'),nowMs:now};
test('dual-channel evidence is complete but cannot actuate public audio',()=>{
 const result=assessMchsTwoChannelSession({...good,operatorHold:false});
 assert.equal(result.complete,true);assert.equal(result.automaticPlaybackEnabled,false);
 assert.equal(result.publicBroadcastAuthorized,false);
});
test('missing agent STOP fails closed',()=>{
 const x=assessMchsTwoChannelSession({...good,agentStop:null});
 assert.equal(x.complete,false);assert.ok(x.holds.some(s=>s.includes('AGENT_STOP')));
});
test('training VLC observation cannot impersonate event playback ACK',()=>{
 const x=assessMchsTwoChannelSession({...good,agentStart:{state:'STARTED',mode:'LAB_PROCESS_ONLY'}});
 assert.equal(x.complete,false);
});
test('operator hold is surfaced explicitly',()=>{
 assert.ok(assessMchsTwoChannelSession(good).holds.includes('OPERATOR_HOLD'));
});
