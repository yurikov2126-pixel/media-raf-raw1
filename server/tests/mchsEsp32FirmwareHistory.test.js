import test from 'node:test';
import assert from 'node:assert/strict';
import {compareEsp32FirmwareHistory} from '../src/lib/mchsEsp32FirmwareHistory.js';
import {recordEsp32Transition} from '../src/lib/mchsEsp32TransitionEvidence.js';
const boot='0123456789abcdef';
const status=(seq,history,nonce=boot)=>({
 bootNonce:nonce,relayTransitionSequence:seq,relayTransitionHistory:history,
 amplifierPower:'ON_COMMANDED',agentMode:'CENTRAL',heartbeatFresh:true,
 leaseValid:true,relayOutputEnabled:true,heartbeatCount:20,relayOnTransitions:2,
 relayOffTransitions:1
});
const ev=(seq,on,reason,uptimeMs=1000)=>({seq,on,reason,uptimeMs});
const observe=(previous,src,when)=>recordEsp32Transition(previous,{
 deviceId:'esp1',reporterId:'agent1',observedAt:when,status:src});
test('first firmware report establishes baseline without inventing historical events',()=>{
 const result=compareEsp32FirmwareHistory(null,status(2,[
  ev(1,true,'SIGNED_POWER_PERMIT'),ev(2,false,'POWER_LEASE_EXPIRED')]));
 assert.equal(result.available,true);
 assert.equal(result.reason,'BASELINE');
 assert.equal(result.events.length,0);
});
test('two rapid off-on changes retain each cause even when final snapshot stays ON',()=>{
 const before=observe(null,status(1,[ev(1,true,'SIGNED_POWER_PERMIT')]),
  '2026-11-05T20:00:00Z');
 const after=observe(before.state,status(3,[
  ev(1,true,'SIGNED_POWER_PERMIT'),
  ev(2,false,'HEARTBEAT_TIMEOUT',2200),
  ev(3,true,'SIGNED_POWER_PERMIT',2400)
 ]),'2026-11-05T20:00:03Z');
 assert.deepEqual(after.added.filter(x=>x.kind.startsWith('FIRMWARE_GPIO_'))
  .map(x=>[x.kind,x.detail,x.uptimeMs]),[
  ['FIRMWARE_GPIO_OFF','HEARTBEAT_TIMEOUT',2200],
  ['FIRMWARE_GPIO_ON','SIGNED_POWER_PERMIT',2400]
 ]);
 assert.equal(after.state.devices.esp1.power,'ON_COMMANDED');
});
test('repeated polling does not duplicate firmware events',()=>{
 const a=observe(null,status(1,[ev(1,true,'SIGNED_POWER_PERMIT')]),
  '2026-11-05T20:00:00Z');
 const b=observe(a.state,status(1,[ev(1,true,'SIGNED_POWER_PERMIT')]),
  '2026-11-05T20:00:03Z');
 assert.equal(b.added.filter(x=>x.kind.startsWith('FIRMWARE_GPIO_')).length,0);
});
test('new bootNonce resets comparison epoch',()=>{
 const prev={bootNonce:boot,relayTransitionSequence:100};
 const out=compareEsp32FirmwareHistory(prev,status(1,[ev(1,true,'SIGNED_POWER_PERMIT')],
  'fedcba9876543210'));
 assert.equal(out.reason,'REBOOT_NEW_EPOCH');
 assert.equal(out.events.length,0);
});
test('overflow is indicated when previous sequence falls out of firmware ring',()=>{
 const prev={bootNonce:boot,relayTransitionSequence:1};
 const entries=Array.from({length:12},(_,i)=>ev(i+10,i%2===0,
  i%2===0?'SIGNED_POWER_PERMIT':'POWER_LEASE_EXPIRED'));
 const out=compareEsp32FirmwareHistory(prev,status(21,entries));
 assert.equal(out.events.length,12);
 assert.equal(out.reason,'FIRMWARE_EVENT_HISTORY_OVERFLOW');
});
test('malformed and legacy firmware histories are not accepted as evidence',()=>{
 assert.equal(compareEsp32FirmwareHistory(null,{}).available,false);
 assert.equal(compareEsp32FirmwareHistory(null,status(2,[
  ev(1,true,'SIGNED_POWER_PERMIT'),ev(2,false,'CUSTOM_UNTRUSTED')
 ])).available,false);
 assert.equal(compareEsp32FirmwareHistory(null,status(3,[
  ev(1,true,'SIGNED_POWER_PERMIT'),ev(3,false,'POWER_LEASE_EXPIRED')
 ])).available,false);
});
