import test from 'node:test';
import assert from 'node:assert/strict';
import {correlateEsp32OffEvents} from '../src/lib/mchsEsp32OffCorrelation.js';
import {assessEsp32TransitionEvidence} from '../src/lib/mchsEsp32TransitionEvidence.js';

const t='2026-11-06T12:00:00.000Z';
const e=(kind,at=t,extra={})=>({kind,at,deviceId:'esp32-a',
 reporterId:'windows-agent-1',...extra});
const off=e('FIRMWARE_GPIO_OFF',t,{seq:23,detail:'SIGNED_PERMIT_FALSE'});
test('match a nearby acknowledged OFF from the same registered Agent and device',()=>{
 const rows=[off,
  e('AGENT_POWER_INTENT_RESPONSE','2026-11-06T11:59:56.000Z',{permit:false}),
  e('AGENT_POWER_POWER_COMMAND','2026-11-06T11:59:58.000Z',{permit:false,reason:'INTENT_OFF'})];
 const result=correlateEsp32OffEvents(rows);
 assert.equal(result.items.length,1);
 assert.equal(result.items[0].classification,'AGENT_OFF_ACK_NEARBY');
 assert.equal(result.items[0].agentOffAcknowledgedNearby,true);
 assert.equal(result.items[0].agentIntentDeniedNearby,true);
 assert.equal(result.items[0].approximateGapMs,2000);
 assert.equal(result.physicalOutputConfirmed,false);
 assert.equal(result.items[0].exactTransitionTimeKnown,false);
});
test('Agent request to turn ON must never be mistaken for OFF acknowledgement',()=>{
 const result=correlateEsp32OffEvents([off,
  e('AGENT_POWER_POWER_COMMAND',t,{permit:true})]);
 assert.equal(result.items[0].classification,'NO_DECISIVE_AGENT_EVIDENCE');
 assert.equal(result.items[0].agentOffAcknowledgedNearby,false);
});
test('do not join different ESP32, reporter, or observations outside 15 seconds',()=>{
 const rows=[off,
  e('AGENT_POWER_POWER_COMMAND',t,{permit:false,deviceId:'esp32-other'}),
  e('AGENT_POWER_POWER_COMMAND',t,{permit:false,reporterId:'agent-other'}),
  e('AGENT_POWER_POWER_COMMAND','2026-11-06T11:59:30.000Z',{permit:false})];
 const out=correlateEsp32OffEvents(rows);
 assert.equal(out.items[0].nearestAgentKind,null);
 assert.equal(out.items[0].classification,'NO_DECISIVE_AGENT_EVIDENCE');
});
test('firmware lease expiry remains explicitly labeled despite Agent fetch error',()=>{
 const rows=[
  e('FIRMWARE_GPIO_OFF',t,{seq:17,detail:'POWER_LEASE_EXPIRED'}),
  e('AGENT_POWER_INTENT_ERROR','2026-11-06T11:59:53.000Z',{reason:'FETCH_ERROR_OFF'})];
 const out=correlateEsp32OffEvents(rows);
 assert.equal(out.items[0].firmwareHint,'ESP32_LEASE_EXPIRED');
 assert.equal(out.items[0].classification,'AGENT_ERROR_NEARBY');
 assert.equal(out.items[0].agentOffAcknowledgedNearby,false);
});
test('return bounded, read-only events for a single scoped ESP32',()=>{
 const rows=Array.from({length:20},(_,i)=>
  e('FIRMWARE_GPIO_OFF',new Date(Date.parse(t)+i*100).toISOString(),
   {seq:i+1,detail:'HEARTBEAT_TIMEOUT'}));
 const out=correlateEsp32OffEvents(rows);
 assert.equal(out.items.length,12);
 assert.equal(out.items[0].seq,9);
 assert.equal(out.allTimesApproximate,true);
});
test('integrated readiness keeps events scoped by device and never proves PA output',()=>{
 const raw={events:[off,
  e('AGENT_POWER_POWER_COMMAND','2026-11-06T11:59:56.000Z',{permit:false}),
  e('AGENT_POWER_POWER_COMMAND','2026-11-06T11:59:56.000Z',
    {permit:false,deviceId:'different'}),
  e('FIRMWARE_GPIO_OFF',t,{deviceId:'different',seq:88,detail:'WIFI_LOST'})]};
 const result=assessEsp32TransitionEvidence(raw,{
  deviceId:'esp32-a',nowMs:Date.parse('2026-11-06T12:00:05Z')});
 assert.equal(result.offCorrelations.items.length,1);
 assert.equal(result.offCorrelations.items[0].seq,23);
 assert.equal(result.offCorrelations.items[0].agentOffAcknowledgedNearby,true);
 assert.equal(result.actualMainsPowerVerified,false);
});
