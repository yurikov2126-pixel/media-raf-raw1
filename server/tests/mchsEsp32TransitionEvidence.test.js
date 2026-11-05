import test from 'node:test';
import assert from 'node:assert/strict';
import {recordEsp32Transition,assessEsp32TransitionEvidence} from '../src/lib/mchsEsp32TransitionEvidence.js';
const base='2026-11-05T20:00:00.000Z';
const mk=(time,overrides={})=>({deviceId:'esp1',reporterId:'agent1',observedAt:time,
 status:{amplifierPower:'ON_COMMANDED',agentMode:'CENTRAL',heartbeatFresh:true,
  leaseValid:true,relayOutputEnabled:true,heartbeatCount:42,...overrides}});
test('first status establishes a baseline and never invents a dropout',()=>{
 const r=recordEsp32Transition(null,mk(base));
 assert.equal(r.added.length,0);
 assert.equal(r.state.devices.esp1.power,'ON_COMMANDED');
});
test('OFF during lease loss records separate observed transitions, not proof of mains failure',()=>{
 const first=recordEsp32Transition(null,mk(base));
 const second=recordEsp32Transition(first.state,mk('2026-11-05T20:00:03.000Z',{
  amplifierPower:'OFF_COMMANDED',leaseValid:false,heartbeatCount:43}));
 assert.deepEqual(second.added.map(x=>x.kind),['COMMANDED_POWER_CHANGED','LEASE_CHANGED']);
 const report=assessEsp32TransitionEvidence(second.state,{deviceId:'esp1',
  nowMs:Date.parse('2026-11-05T20:00:04.000Z')});
 assert.equal(report.suspectCount,2);
 assert.equal(report.actualMainsPowerVerified,false);
 assert.equal(report.stabilityConfirmed,false);
});
test('telemetry gap and heartbeat counter reset are distinguishable',()=>{
 const prior=recordEsp32Transition(null,mk(base));
 const next=recordEsp32Transition(prior.state,mk('2026-11-05T20:00:20.000Z',{
  heartbeatCount:0}));
 assert.deepEqual(next.added.map(x=>x.kind),['TELEMETRY_GAP','HEARTBEAT_COUNTER_RESET']);
});
test('out-of-order and duplicate reports never rewrite newer state',()=>{
 const first=recordEsp32Transition(null,mk(base));
 const second=recordEsp32Transition(first.state,mk('2026-11-05T20:00:03.000Z'));
 const replay=recordEsp32Transition(second.state,mk(base,{amplifierPower:'OFF_COMMANDED'}));
 assert.equal(replay.reason,'OLD_OR_DUPLICATE_OBSERVATION');
 assert.equal(replay.state.devices.esp1.power,'ON_COMMANDED');
});
test('different reporters, invalid input, and unrelated ESP32 stay scoped',()=>{
 const first=recordEsp32Transition(null,mk(base));
 const next=recordEsp32Transition(first.state,{...mk('2026-11-05T20:00:03.000Z'),
  reporterId:'agent2'});
 assert.equal(next.added[0].kind,'REPORTER_CHANGED');
 const none=assessEsp32TransitionEvidence(next.state,{deviceId:'another',
  nowMs:Date.parse('2026-11-05T20:00:04.000Z')});
 assert.equal(none.events.length,0);
 assert.equal(recordEsp32Transition(next.state,{deviceId:null}).reason,'INVALID_OBSERVATION');
});
