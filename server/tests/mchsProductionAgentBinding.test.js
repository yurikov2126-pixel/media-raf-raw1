import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveMchsProductionAgentBinding,selectMchsBoundEsp32Evidence}
 from '../src/lib/mchsProductionAgentBinding.js';

const nowMs=Date.parse('2026-11-06T10:00:00.000Z');
const observedAt=new Date(nowMs-1000).toISOString();
test('production Agent binding takes precedence over old lab variable',()=>{
 const binding=resolveMchsProductionAgentBinding({
  MCHS_MAIN_STATION_AGENT_DEVICE_ID:'main-device',
  MCHS_AGENT_LAB_DEVICE_ID:'lab-device'});
 assert.deepEqual(binding,{deviceId:'main-device',source:'PRODUCTION_EXPLICIT',
  legacy:false,configured:true});
});
test('legacy binding remains read-only and visibly identified during migration',()=>{
 const binding=resolveMchsProductionAgentBinding({MCHS_AGENT_LAB_DEVICE_ID:'lab-device'});
 assert.equal(binding.deviceId,'lab-device');
 assert.equal(binding.legacy,true);
 assert.equal(binding.configured,false);
 assert.equal(binding.source,'LEGACY_LAB_FALLBACK');
});
test('unconfigured binding never chooses a random Windows Agent',()=>{
 assert.deepEqual(resolveMchsProductionAgentBinding({}),{
  deviceId:null,source:'UNCONFIGURED',legacy:false,configured:false});
});
test('only one fresh ESP32 from exactly the bound Agent may appear in diagnostics',()=>{
 const raw={devices:{right:{reporterId:'main-device',observedAt},
  old:{reporterId:'main-device',observedAt:new Date(nowMs-50000).toISOString()},
  different:{reporterId:'lab-device',observedAt}}};
 assert.equal(selectMchsBoundEsp32Evidence(raw,{deviceId:'main-device',nowMs}).deviceId,'right');
 assert.equal(selectMchsBoundEsp32Evidence(raw,{deviceId:'lab-device',nowMs}).deviceId,'different');
 assert.equal(selectMchsBoundEsp32Evidence(raw,{deviceId:'absent',nowMs}).deviceId,null);
});
test('two fresh devices for the same reporter fail closed rather than pick first',()=>{
 const raw={devices:{a:{reporterId:'main-device',observedAt},
  b:{reporterId:'main-device',observedAt}}};
 assert.deepEqual(selectMchsBoundEsp32Evidence(raw,{deviceId:'main-device',nowMs}),
  {deviceId:null,reason:'AMBIGUOUS_FRESH_ESP32',ambiguous:true});
});
test('stale, future, and unbound device evidence never proves active link',()=>{
 const raw={devices:{old:{reporterId:'main-device',
  observedAt:new Date(nowMs-13000).toISOString()},
  future:{reporterId:'main-device',observedAt:new Date(nowMs+2000).toISOString()}}};
 assert.equal(selectMchsBoundEsp32Evidence(raw,{deviceId:'main-device',nowMs}).deviceId,null);
 assert.equal(selectMchsBoundEsp32Evidence(raw,{deviceId:null,nowMs}).deviceId,null);
});
