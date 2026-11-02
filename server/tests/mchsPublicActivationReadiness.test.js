import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsPublicActivation} from '../src/lib/mchsPublicActivationReadiness.js';
const verified={source:{officiallyAttested:true,freshEventVerified:true,region:'Тульская область'},
 worker:{eventBoundStart:true,eventBoundStop:true,completedPlaybackVerified:true},
 agent:{eventBoundStart:true,eventBoundStop:true,completedPlaybackVerified:true},
 stop:{independentChannelsVerified:true,lateStartRejected:true,linkLossFailsSafe:true},
 trial:{isolatedPublicOutput:true,speakersPhysicallyDisconnected:true,dangerAndClearCompleted:true},
 operator:{authorizedAfterTrial:true}};
test('missing physical test, attestation or channel evidence blocks readiness',()=>{
 const absent=assessMchsPublicActivation();
 assert.equal(absent.ready,false);assert.ok(absent.missing.length>10);
 assert.equal(assessMchsPublicActivation({...verified,source:{...verified.source,officiallyAttested:false}}).ready,false);
 assert.equal(assessMchsPublicActivation({...verified,stop:{...verified.stop,linkLossFailsSafe:false}}).ready,false);
 assert.equal(assessMchsPublicActivation({...verified,trial:{...verified.trial,speakersPhysicallyDisconnected:false}}).ready,false);
});
test('even complete trial evidence never silently toggles production broadcast',()=>{
 const complete=assessMchsPublicActivation(verified);
 assert.equal(complete.ready,true);assert.equal(complete.automaticBroadcastEnabled,false);
 assert.equal(complete.publicActivationPerformed,false);
});
