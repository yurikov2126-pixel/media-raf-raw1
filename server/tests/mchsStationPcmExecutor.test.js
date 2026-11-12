import test from 'node:test';
import assert from 'node:assert/strict';
import {createMchsStationPcmExecutor} from '../src/lib/mchsStationPcmExecutor.js';

const event={eventId:'danger_001',eventType:'MISSILE_DANGER',
  assetId:'asset_alarm',repeats:2};
const frame=(v=4)=>Buffer.alloc(16,v);
const pcm=(buffer,closed)=>({
  size:buffer.length,
  read:(position,size)=>buffer.subarray(position,position+size),
  close:()=>closed.push(true)
});

test('dedicated source replaces encoder input, repeats exact PCM and awaits actual program',()=>{
 const closed=[],exec=createMchsStationPcmExecutor();
 assert.equal(exec.prepare({...event,pcm:pcm(frame(7),closed)}).ok,true);
 assert.equal(exec.snapshot().phase,'PREEMPTING');
 assert.deepEqual(exec.replace(frame(2)),frame(7));
 assert.equal(exec.snapshot().phase,'PLAYING');
 assert.deepEqual(exec.replace(frame(2)),frame(7));
 assert.equal(exec.snapshot().phase,'RESUMING');
 assert.equal(exec.snapshot().active,false);
 assert.deepEqual(closed,[true]);
 exec.observeProgram(frame(0));
 assert.equal(exec.snapshot().phase,'RESUMING');
 exec.observeProgram(frame(9));
 assert.equal(exec.snapshot().phase,'COMPLETE');
 assert.equal(exec.snapshot().session.naturalCompletion,true);
 assert.equal(exec.snapshot().session.programRestored,true);
});

test('completed alarm returns to verified idle without claiming program audio',()=>{
 const terminals=[],exec=createMchsStationPcmExecutor({onTerminal:entry=>terminals.push(entry)});
 exec.prepare({...event,pcm:pcm(frame(7),[])});
 exec.replace(frame(2));
 exec.replace(frame(2));
 assert.equal(exec.snapshot().phase,'RESUMING');
 exec.observeProgram(frame(0),{stationIdleConfirmed:true});
 assert.equal(exec.snapshot().phase,'COMPLETE');
 assert.equal(exec.snapshot().session.naturalCompletion,true);
 assert.equal(exec.snapshot().session.programRestored,false);
 assert.equal(exec.snapshot().session.idleAfterAlert,true);
 assert.equal(exec.snapshot().session.failure,null);
 assert.equal(terminals.length,1);
 assert.equal(terminals[0].phase,'COMPLETE');
 const clear={...event,eventId:'all_clear_after_idle',eventType:'MISSILE_ALL_CLEAR',repeats:1};
 assert.equal(exec.prepare({...clear,pcm:pcm(frame(8),[])}).ok,true);
});

test('unverified idle or non-silent program cannot masquerade as idle completion',()=>{
 const exec=createMchsStationPcmExecutor();
 exec.prepare({...event,pcm:pcm(frame(7),[])});
 exec.replace(frame(2));
 exec.replace(frame(2));
 exec.observeProgram(frame(0));
 assert.equal(exec.snapshot().phase,'RESUMING');
 exec.observeProgram(frame(3),{stationIdleConfirmed:true});
 assert.equal(exec.snapshot().phase,'COMPLETE');
 assert.equal(exec.snapshot().session.programRestored,true);
 assert.equal(exec.snapshot().session.idleAfterAlert,false);
});

test('silent program after completed ALARM becomes FAILED rather than blocking ALL-CLEAR forever',()=>{
 const closed=[],terminals=[],exec=createMchsStationPcmExecutor({
  onTerminal:result=>terminals.push(result)
 });
 assert.equal(exec.prepare({...event,pcm:pcm(frame(7),closed)}).ok,true);
 exec.replace(frame(2));
 exec.replace(frame(2));
 assert.equal(exec.snapshot().phase,'RESUMING');
 // 48kHz stereo PCM16: 5 seconds of ordinary-program silence.
 for(let i=0;i<24;i++)exec.observeProgram(Buffer.alloc(38400));
 assert.equal(exec.snapshot().phase,'RESUMING');
 exec.observeProgram(Buffer.alloc(38400));
 assert.equal(exec.snapshot().phase,'FAILED');
 assert.equal(exec.snapshot().session.naturalCompletion,true);
 assert.equal(exec.snapshot().session.programRestored,false);
 assert.equal(exec.snapshot().session.failure,'SILENT_PROGRAM_RETURN_TIMEOUT');
 assert.equal(terminals.length,1);
 assert.equal(terminals[0].phase,'FAILED');
 const clear={...event,eventId:'clear_after_silence',
  eventType:'MISSILE_ALL_CLEAR',repeats:1};
 assert.equal(exec.prepare({...clear,pcm:pcm(frame(8),[])}).ok,true);
 assert.equal(exec.snapshot().phase,'PREEMPTING');
});

test('non-silent program return before deadline is still a genuine COMPLETE',()=>{
 const terminals=[],exec=createMchsStationPcmExecutor({
  onTerminal:result=>terminals.push(result)
 });
 exec.prepare({...event,pcm:pcm(frame(7),[])});
 exec.replace(frame(2));
 exec.replace(frame(2));
 for(let i=0;i<24;i++)exec.observeProgram(Buffer.alloc(38400));
 assert.equal(exec.snapshot().phase,'RESUMING');
 exec.observeProgram(Buffer.alloc(38400,1));
 assert.equal(exec.snapshot().phase,'COMPLETE');
 assert.equal(exec.snapshot().session.programRestored,true);
 assert.equal(terminals[0].phase,'COMPLETE');
});

test('event-bound PCM clock provides bounded GPIO13 pre-roll without consuming alert bytes',()=>{
 const events=[],closed=[],exec=createMchsStationPcmExecutor({
   preRollMs:200,onPreRoll:entry=>events.push(entry)
 });
 const clear={...event,eventId:'power_preroll',eventType:'MISSILE_ALL_CLEAR',repeats:1};
 assert.equal(exec.prepare({...clear,pcm:pcm(frame(8),closed)}).ok,true);
 assert.equal(exec.snapshot().phase,'PREEMPTING');
 assert.equal(exec.snapshot().preRollActive,true);
 assert.equal(exec.snapshot().preRollRemainingMs,200);
 const program=Buffer.alloc(3840,2);
 for(let n=0;n<10;n++){
   assert.deepEqual(exec.replace(program),program);
 }
 assert.equal(exec.snapshot().preRollActive,false);
 assert.equal(exec.snapshot().phase,'PREEMPTING');
 assert.equal(events.length,2);
 assert.equal(events[0].eventId,'power_preroll');
 assert.equal(events[1].ended,true);
 assert.equal(events[1].powerAcknowledged,false);
 assert.deepEqual(exec.replace(frame(1)),frame(8));
 assert.equal(exec.snapshot().phase,'RESUMING');
});

test('pre-roll is disabled by default and input is validated',()=>{
 assert.throws(()=>createMchsStationPcmExecutor({preRollMs:-1}),/INVALID_PRE_ROLL_MS/);
 assert.throws(()=>createMchsStationPcmExecutor({preRollMs:7000}),/INVALID_PRE_ROLL_MS/);
 const exec=createMchsStationPcmExecutor();
 exec.prepare({...event,pcm:pcm(frame(7),[])});
 assert.equal(exec.snapshot().preRollActive,false);
 assert.deepEqual(exec.replace(frame(1)),frame(7));
});

test('single-frame all clear completes normally without skipped preempt acknowledgment',()=>{
 const exec=createMchsStationPcmExecutor();
 const clear={...event,eventId:'clear_001',eventType:'MISSILE_ALL_CLEAR',repeats:1};
 assert.equal(exec.prepare({...clear,pcm:pcm(frame(8),[])}).ok,true);
 assert.deepEqual(exec.replace(frame(1)),frame(8));
 assert.equal(exec.snapshot().phase,'RESUMING');
 exec.observeProgram(frame(1));
 assert.equal(exec.snapshot().phase,'COMPLETE');
});

test('last partial alert frame is padded with silence, never stale music',()=>{
 const exec=createMchsStationPcmExecutor();
 const clear={...event,eventId:'clear_partial',eventType:'MISSILE_ALL_CLEAR',repeats:1};
 assert.equal(exec.prepare({...clear,pcm:pcm(Buffer.alloc(8,5),[])}).ok,true);
 const output=exec.replace(frame(12));
 assert.deepEqual(output,Buffer.concat([Buffer.alloc(8,5),Buffer.alloc(8,0)]));
 assert.equal(exec.snapshot().phase,'RESUMING');
});

test('broken PCM source aborts without fake FILE_COMPLETED or leaking music',()=>{
 const exec=createMchsStationPcmExecutor();
 const broken={size:16,read:()=>Buffer.alloc(2),close:()=>{}};
 assert.equal(exec.prepare({...event,pcm:broken}).ok,true);
 assert.deepEqual(exec.replace(frame(9)),frame(0));
 assert.equal(exec.snapshot().phase,'FAILED');
 assert.equal(exec.snapshot().session.naturalCompletion,false);
});

test('STOP releases PCM source and cannot be labeled a natural finish',()=>{
 const closed=[],exec=createMchsStationPcmExecutor();
 exec.prepare({...event,pcm:pcm(frame(9),closed)});
 assert.equal(exec.abort('OPERATOR_STOP').phase,'FAILED');
 assert.deepEqual(closed,[true]);
 assert.equal(exec.snapshot().active,false);
 assert.equal(exec.snapshot().session.programRestored,false);
});

test('refuses event replay, bad asset, bad PCM and simultaneous active event',()=>{
 const exec=createMchsStationPcmExecutor();
 assert.equal(exec.prepare({...event,pcm:{size:1,read:()=>null,close:()=>{}}}).reason,'INVALID_PCM_SOURCE');
 assert.equal(exec.prepare({...event,pcm:pcm(frame(7),[])}).ok,true);
 assert.equal(exec.prepare({...event,eventId:'another',pcm:pcm(frame(7),[])}).reason,'ACTIVE_PCM_SOURCE');
 exec.abort();
 assert.equal(exec.prepare({...event,pcm:pcm(frame(7),[])}).reason,'REPLAYED_EVENT');
 const clear={...event,eventId:'another',eventType:'MISSILE_ALL_CLEAR',repeats:2};
 assert.equal(exec.prepare({...clear,pcm:pcm(frame(7),[])}).reason,'INVALID_EVENT_BINDING');
});

test('priority executor exports no GPIO, Android, or public start transport',()=>{
 const exec=createMchsStationPcmExecutor();
 const status=exec.snapshot();
 assert.equal(status.acceptsAndroidEvents,false);
 assert.equal(status.hasLiveStartRoute,false);
 assert.equal(status.gpioControlEnabled,false);
 assert.equal(typeof exec.sendPower,'undefined');
 assert.equal(typeof exec.startAndroidEvent,'undefined');
});
