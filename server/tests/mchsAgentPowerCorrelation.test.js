import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeAgentPowerEvidence} from '../src/lib/mchsAgentPowerCorrelation.js';
const nowMs=Date.parse('2026-11-06T08:00:00.000Z');
const e=(id='a'.repeat(24),kind='RELAY_TRANSITION',overrides={})=>({
 id,kind,at:new Date(nowMs-1000).toISOString(),reason:'OFF_SERVER_DENIED',
 permit:false,phase:'CENTRAL',...overrides});
const options={deviceId:'esp-a',reporterId:'radio-agent-1',nowMs};
test('accept only minimal valid diagnostic event tied to authenticated reporter',()=>{
 const r=mergeAgentPowerEvidence(null,{...options,observations:[e()]});
 assert.equal(r.added.length,1);
 assert.equal(r.added[0].kind,'AGENT_POWER_RELAY_TRANSITION');
 assert.equal(r.added[0].deviceId,'esp-a');
 assert.equal(r.added[0].permit,false);
 assert.equal(r.added[0].reason,'OFF_SERVER_DENIED');
 assert.equal(r.rejected,false);
});
test('repeat telemetry poll does not duplicate event',()=>{
 const first=mergeAgentPowerEvidence(null,{...options,observations:[e()]});
 const second=mergeAgentPowerEvidence(first.state,{...options,observations:[e()]});
 assert.equal(second.added.length,0);
 assert.equal(second.state.events.length,1);
});
test('refuse embedded sensitive data by stripping unknown fields',()=>{
 const row=e('b'.repeat(24),'POWER_ERROR',{
  token:'rr_secret',headers:{authorization:'Bearer hidden'},
  url:'https://secret.invalid',errorType:'TimeoutError'});
 const out=mergeAgentPowerEvidence(null,{...options,observations:[row]});
 assert.equal(out.added.length,1);
 assert.equal(out.added[0].url,undefined);
 assert.equal(out.added[0].token,undefined);
 assert.equal(out.added[0].headers,undefined);
 assert.equal(out.added[0].errorType,undefined);
});
test('reject stale, future, invalid event kind and invalid reason codes',()=>{
 const entries=[
  e('1'.repeat(24),'POWER_COMMAND',{at:new Date(nowMs-620000).toISOString()}),
  e('2'.repeat(24),'POWER_COMMAND',{at:new Date(nowMs+80000).toISOString()}),
  e('3'.repeat(24),'UNKNOWN_KIND'),
  e('4'.repeat(24),'POWER_COMMAND',{reason:'Bearer token=bad'}),
  e('5'.repeat(24),'POWER_COMMAND',{permit:'true'})
 ];
 const out=mergeAgentPowerEvidence(null,{...options,observations:entries});
 assert.equal(out.added.length,0);
});
test('reject oversized batch, preserve already-recorded ESP32 transitions',()=>{
 const prior={devices:{esp1:{power:'ON_COMMANDED'}},events:[
  {deviceId:'esp-a',kind:'FIRMWARE_GPIO_OFF',detail:'POWER_LEASE_EXPIRED'}]};
 const r=mergeAgentPowerEvidence(prior,{...options,observations:[e()]});
 assert.equal(r.state.events.length,2);
 assert.deepEqual(r.state.devices,prior.devices);
 assert.equal(mergeAgentPowerEvidence(prior,{...options,
  observations:Array.from({length:17},(_,i)=>e(i.toString(16).padStart(24,'0')))}).rejected,true);
});
