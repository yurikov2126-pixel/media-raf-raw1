import test from 'node:test';
import assert from 'node:assert/strict';
import {createMchsWorkerPcmEvidence} from '../src/lib/mchsWorkerPcmEvidence.js';

const event={eventId:'danger_pcm_1',eventType:'MISSILE_DANGER',assetId:'asset_alarm',repeats:2};
const pcm=(value=1)=>Buffer.alloc(3840,value);
const active=(playedBytes=0)=>({active:true,playedBytes,repeats:2,completedRepeats:0});
const finished={active:false,playedBytes:7680,repeats:2,completedRepeats:2,lastStopReason:'FILE_COMPLETED'};
const ordinary={active:false,playedBytes:7680,repeats:2,completedRepeats:2,lastStopReason:'FILE_COMPLETED'};

test('HTTP admission is not evidence of any PCM entering encoder',()=>{
 const observer=createMchsWorkerPcmEvidence();
 assert.equal(observer.begin(event).phase,'PREEMPTING');
 assert.equal(observer.snapshot().acceptedFrames,0);
 assert.equal(observer.snapshot().phase,'PREEMPTING');
 assert.equal(observer.snapshot().mainAirCommandEnabled,false);
});

test('real overlay PCM frame moves to PLAYING, natural final frame then RESUMING',()=>{
 const observer=createMchsWorkerPcmEvidence();
 observer.begin(event);
 observer.observe({before:active(0),after:active(3840),frame:pcm(),output:pcm()});
 assert.equal(observer.snapshot().phase,'PLAYING');
 observer.observe({before:active(3840),after:finished,frame:pcm(),output:pcm()});
 assert.equal(observer.snapshot().phase,'RESUMING');
 assert.equal(observer.snapshot().session.naturalCompletion,true);
 assert.equal(observer.snapshot().session.programRestored,false);
});

test('normal program return requires subsequent non-silent frame, not a timeout',()=>{
 const observer=createMchsWorkerPcmEvidence();
 observer.begin(event);
 observer.observe({before:active(0),after:active(3840),frame:pcm(),output:pcm()});
 observer.observe({before:active(3840),after:finished,frame:pcm(),output:pcm()});
 observer.observe({before:ordinary,after:ordinary,frame:pcm(0),output:pcm(0)});
 assert.equal(observer.snapshot().phase,'RESUMING');
 observer.observe({before:ordinary,after:ordinary,frame:pcm(),output:pcm()});
 assert.equal(observer.snapshot().phase,'COMPLETE');
 assert.equal(observer.snapshot().session.programRestored,true);
 assert.equal(observer.snapshot().resumedFrames,1);
});

test('truncated PCM must fail without synthetic natural completion',()=>{
 const observer=createMchsWorkerPcmEvidence();
 observer.begin(event);
 observer.observe({before:active(0),after:active(3840),frame:pcm(),output:pcm()});
 observer.observe({before:active(3840),after:{...finished,lastStopReason:'SOURCE_READ_FAILED',completedRepeats:0},frame:pcm(),output:pcm(0)});
 assert.equal(observer.snapshot().phase,'FAILED');
 assert.equal(observer.snapshot().session.naturalCompletion,false);
});

test('operator STOP cancels current event without false COMPLETE',()=>{
 const observer=createMchsWorkerPcmEvidence();
 observer.begin(event);
 observer.abort('OPERATOR_STOP');
 assert.equal(observer.snapshot().phase,'FAILED');
 assert.equal(observer.snapshot().last.failure,'OPERATOR_STOP');
});

test('invalid encoder PCM cannot confirm preemption',()=>{
 const observer=createMchsWorkerPcmEvidence();
 observer.begin(event);
 observer.observe({before:active(0),after:active(3840),frame:pcm(),output:Buffer.alloc(1)});
 assert.equal(observer.snapshot().phase,'FAILED');
 assert.equal(observer.snapshot().last.failure,'INVALID_ENCODER_FRAME');
});

test('second event follows successful first with independent observation',()=>{
 const observer=createMchsWorkerPcmEvidence();
 observer.begin(event);
 observer.observe({before:active(0),after:finished,frame:pcm(),output:pcm()});
 observer.observe({before:ordinary,after:ordinary,frame:pcm(),output:pcm()});
 assert.equal(observer.snapshot().phase,'COMPLETE');
 assert.equal(observer.begin({...event,eventId:'clear_pcm_1',eventType:'MISSILE_ALL_CLEAR',repeats:1}).phase,'PREEMPTING');
 assert.equal(observer.snapshot().acceptedFrames,0);
 assert.equal(observer.begin(event).accepted,false);
});

test('evidence cannot energize amplifier or start real Android dispatch',()=>{
 const observer=createMchsWorkerPcmEvidence();
 observer.begin(event);
 const result=observer.snapshot();
 assert.equal(result.publicRadioEnabled,false);
 assert.equal(result.amplifierEnabled,false);
 assert.equal(result.liveDispatchAuthorized,false);
 assert.equal(result.mainAirCommandEnabled,false);
 assert.equal(result.evidenceOnly,true);
});
