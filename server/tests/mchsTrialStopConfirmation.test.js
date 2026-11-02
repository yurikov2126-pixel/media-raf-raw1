import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsTrialStopConfirmation} from '../src/lib/mchsTrialStopConfirmation.js';
const now=Date.parse('2026-11-02T10:00:00Z');
const ok={mode:'LAB_PROCESS_ONLY',kind:'TRIAL_VLC_STOP',processExited:true,relayClosed:true,
 paOutputVerified:false,stationPlaybackStoppedVerified:false,receivedAt:new Date(now-1000).toISOString()};
test('fresh verified local shutdown is not a PA or station stop',()=>{
 const x=assessMchsTrialStopConfirmation(ok,{deviceBound:true,nowMs:now});
 assert.equal(x.status,'LAB_PROCESS_STOP_CONFIRMED');
 assert.equal(x.paOutputVerified,false);
 assert.equal(x.stationPlaybackStoppedVerified,false);
 assert.equal(x.dispatchAuthorized,false);
});
test('missing, stale or future-dated report is unconfirmed',()=>{
 for(const e of [null,{...ok,receivedAt:new Date(now-31000).toISOString()},
 {...ok,receivedAt:new Date(now+1000).toISOString()}]){
  const x=assessMchsTrialStopConfirmation(e,{deviceBound:true,nowMs:now});
  assert.equal(x.status,'STOP_NOT_CONFIRMED');
 }
});
test('alive VLC or open relay must not be confirmed',()=>{
 assert.equal(assessMchsTrialStopConfirmation({...ok,processExited:false},{deviceBound:true,nowMs:now}).status,'STOP_NOT_CONFIRMED');
 assert.equal(assessMchsTrialStopConfirmation({...ok,relayClosed:false},{deviceBound:true,nowMs:now}).status,'STOP_NOT_CONFIRMED');
});
test('device must be bound and malformed PA claims rejected',()=>{
 assert.equal(assessMchsTrialStopConfirmation(ok,{deviceBound:false,nowMs:now}).status,'STOP_NOT_CONFIRMED');
 assert.equal(assessMchsTrialStopConfirmation({...ok,paOutputVerified:true},{deviceBound:true,nowMs:now}).status,'STOP_NOT_CONFIRMED');
});
