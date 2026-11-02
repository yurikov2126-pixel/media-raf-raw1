import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMchsTrialStopEvidence} from '../src/lib/mchsTrialStopEvidence.js';
const base={mode:'LAB_PROCESS_ONLY',kind:'TRIAL_VLC_STOP',processExited:true,relayClosed:true,
 reason:'WATCHDOG',paOutputVerified:false,stationPlaybackStoppedVerified:false};
test('lab exit and relay closure only verify laboratory process',()=>{
 const r=validateMchsTrialStopEvidence(base);
 assert.equal(r.confirmed,true);
 assert.equal(r.paOutputVerified,false);
 assert.equal(r.stationPlaybackStoppedVerified,false);
});
test('running process cannot be marked stopped',()=>{
 assert.equal(validateMchsTrialStopEvidence({...base,processExited:false}).confirmed,false);
});
test('unclosed relay cannot be marked stopped',()=>{
 assert.equal(validateMchsTrialStopEvidence({...base,relayClosed:false}).confirmed,false);
});
test('reject attempts to claim PA or main station verified',()=>{
 assert.equal(validateMchsTrialStopEvidence({...base,paOutputVerified:true}),null);
 assert.equal(validateMchsTrialStopEvidence({...base,stationPlaybackStoppedVerified:true}),null);
});
test('reject malformed sources and freeform reason',()=>{
 assert.equal(validateMchsTrialStopEvidence({...base,mode:'LIVE'}),null);
 assert.equal(validateMchsTrialStopEvidence({...base,reason:'REMOTE_START'}),null);
});
