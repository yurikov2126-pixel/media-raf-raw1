import test from 'node:test';
import assert from 'node:assert/strict';
import {compareEsp32FirmwareHistory} from '../src/lib/mchsEsp32FirmwareHistory.js';
import {recordEsp32Transition,assessEsp32TransitionEvidence} from '../src/lib/mchsEsp32TransitionEvidence.js';
import {summarizeEsp32Dropouts} from '../src/lib/mchsEsp32DropoutSummary.js';
const nonce='0123456789abcdef';
const ev=(seq,on,reason)=>({seq,on,reason,uptimeMs:seq*1000});
const status=(seq,history)=>({bootNonce:nonce,relayTransitionSequence:seq,
 relayTransitionHistory:history,amplifierPower:'ON_COMMANDED',
 heartbeatFresh:true,leaseValid:true,relayOutputEnabled:true,
 agentMode:'CENTRAL',relayOnTransitions:2,relayOffTransitions:1});
test('new firmware ring after legacy status is baseline, not replayed as live dropouts',()=>{
 const previous={bootNonce:nonce,relayTransitionSequence:null};
 const result=compareEsp32FirmwareHistory(previous,status(3,[
  ev(1,true,'SIGNED_POWER_PERMIT'),ev(2,false,'POWER_LEASE_EXPIRED'),
  ev(3,true,'SIGNED_POWER_PERMIT')]));
 assert.equal(result.available,true);
 assert.equal(result.reason,'BASELINE');
 assert.deepEqual(result.events,[]);
});
test('after baseline, genuine new firmware OFF and ON are observed in order',()=>{
 const before=recordEsp32Transition(null,{deviceId:'esp',reporterId:'agent',
  observedAt:'2026-11-06T10:00:00Z',
  status:{...status(2,[ev(1,true,'SIGNED_POWER_PERMIT'),ev(2,false,'POWER_LEASE_EXPIRED')]),
   relayTransitionSequence:undefined}});
 const first=recordEsp32Transition(before.state,{deviceId:'esp',reporterId:'agent',
  observedAt:'2026-11-06T10:00:05Z',
  status:status(3,[ev(1,true,'SIGNED_POWER_PERMIT'),
   ev(2,false,'POWER_LEASE_EXPIRED'),ev(3,true,'SIGNED_POWER_PERMIT')])});
 assert.equal(first.added.filter(e=>e.kind==='FIRMWARE_GPIO_OFF').length,0);
 const next=recordEsp32Transition(first.state,{deviceId:'esp',reporterId:'agent',
  observedAt:'2026-11-06T10:00:10Z',
  status:status(5,[ev(2,false,'POWER_LEASE_EXPIRED'),ev(3,true,'SIGNED_POWER_PERMIT'),
   ev(4,false,'HEARTBEAT_TIMEOUT'),ev(5,true,'SIGNED_POWER_PERMIT')])});
 assert.deepEqual(next.added.filter(e=>e.kind.startsWith('FIRMWARE_GPIO_')).map(e=>e.kind),
  ['FIRMWARE_GPIO_OFF','FIRMWARE_GPIO_ON']);
});
test('firmware default UNSPECIFIED_OFF must not silently invalidate entire ring',()=>{
 const r=compareEsp32FirmwareHistory({bootNonce:nonce,relayTransitionSequence:1},
  status(2,[ev(1,true,'SIGNED_POWER_PERMIT'),ev(2,false,'UNSPECIFIED_OFF')]));
 assert.equal(r.available,true);
 assert.equal(r.events[0].reason,'UNSPECIFIED_OFF');
});
test('summary includes firmware OFF codes and reliability gaps, not Agent decisions',()=>{
 const items=[
  {kind:'FIRMWARE_GPIO_OFF',at:'2026-11-06T10:00:01Z',detail:'HEARTBEAT_TIMEOUT',seq:2},
  {kind:'AGENT_POWER_POWER_COMMAND',detail:'INTENT_ALLOWED'},
  {kind:'FIRMWARE_GPIO_OFF',at:'2026-11-06T10:00:03Z',detail:'POWER_LEASE_EXPIRED',seq:4},
  {kind:'FIRMWARE_HISTORY_OVERFLOW'},
  {kind:'TELEMETRY_GAP'}
 ];
 const r=summarizeEsp32Dropouts(items);
 assert.equal(r.gpioOffObserved,2);
 assert.equal(r.dataGapsObserved,2);
 assert.deepEqual(r.reasons,{HEARTBEAT_TIMEOUT:1,POWER_LEASE_EXPIRED:1});
 assert.equal(r.lastOff.seq,4);
 assert.equal(r.noPhysicalVoltageMeasurement,true);
 assert.equal(r.completeHistoryGuaranteed,false);
});
test('read-only diagnostics include bounded off summary, never power confirmation',()=>{
 const raw={events:[{deviceId:'esp',kind:'FIRMWARE_GPIO_OFF',
  at:'2026-11-06T10:00:01Z',detail:'HEARTBEAT_TIMEOUT',seq:8},
  {deviceId:'other',kind:'FIRMWARE_GPIO_OFF',at:'2026-11-06T10:00:02Z',
   detail:'POWER_LEASE_EXPIRED',seq:4}]};
 const r=assessEsp32TransitionEvidence(raw,{deviceId:'esp',
  nowMs:Date.parse('2026-11-06T10:00:05Z')});
 assert.equal(r.dropoutSummary.gpioOffObserved,1);
 assert.equal(r.dropoutSummary.lastOff.reason,'HEARTBEAT_TIMEOUT');
 assert.equal(r.actualMainsPowerVerified,false);
 assert.equal(r.stabilityConfirmed,false);
});
