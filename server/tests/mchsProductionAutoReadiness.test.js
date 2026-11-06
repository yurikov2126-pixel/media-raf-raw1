import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsProductionAutoReadiness} from '../src/lib/mchsProductionAutoReadiness.js';
const nowMs=Date.parse('2026-11-06T13:00:00.000Z');
const now=new Date(nowMs-1000).toISOString();
const base={
 nowMs,
 flags:{ingest:true,hmacConfigured:true,dispatch:true,coordinator:true},
 allowedChannels:['tula-notifications'],
 androidHealth:{listener:'CONNECTED',lastSeenAt:now},
 rules:{MISSILE_DANGER:{mode:'REVIEW',audioAssetId:'danger',repeats:2},
  MISSILE_ALL_CLEAR:{mode:'REVIEW',audioAssetId:'clear',repeats:1}},
 assets:[{id:'danger',name:'Danger',category:'ALARM',mimeType:'audio/wav',durationMs:3000},
  {id:'clear',name:'All-clear',category:'ALARM',mimeType:'audio/wav',durationMs:3000}],
 worker:{ok:true,data:{enabled:true,terminalJournal:{healthy:true}}},
 agent:{playbackAllowed:true,revokedAt:null,lastSeenAt:now},
 deviceBinding:{configured:true,deviceId:'agent-1'},
 esp32:{fresh:true,heartbeatFresh:true,relayOutputEnabled:true}
};
test('all configured paths show ready-to-evaluate but never claim public PA audio',()=>{
 const out=assessMchsProductionAutoReadiness(base);
 assert.equal(out.configurationReady,true);
 assert.equal(out.automaticAudioTriggered,false);
 assert.equal(out.speakerAudibilityVerified,false);
 assert.equal(out.actualMainsPowerVerified,false);
 assert.equal(out.audio[0].repeats,2);
 assert.equal(out.audio[1].repeats,1);
});
test('disabled dispatch and worker flags are visible as distinct blocking checks',()=>{
 const o=assessMchsProductionAutoReadiness({...base,
  flags:{...base.flags,dispatch:false,coordinator:false},
  worker:{ok:true,data:{enabled:false,terminalJournal:{healthy:true}}}});
 assert.deepEqual(o.holds.filter(x=>x.includes('DISABLED')),[
  'API_DISPATCH_DISABLED','API_COORDINATOR_DISABLED','WORKER_MAIN_COMMANDS_DISABLED']);
});
test('stale Android heartbeat, missing allowlist and HMAC block readiness',()=>{
 const o=assessMchsProductionAutoReadiness({...base,
  flags:{...base.flags,hmacConfigured:false},allowedChannels:[],
  androidHealth:{listener:'CONNECTED',lastSeenAt:new Date(nowMs-120000).toISOString()}});
 assert.ok(o.holds.includes('ANDROID_INGEST_DISABLED_OR_HMAC_MISSING'));
 assert.ok(o.holds.includes('ANDROID_CHANNEL_ALLOWLIST_EMPTY'));
 assert.ok(o.holds.includes('ANDROID_BRIDGE_HEARTBEAT_STALE'));
});
test('wrong ALARM category or empty duration is not a configured audio file',()=>{
 const o=assessMchsProductionAutoReadiness({...base,assets:[
  {...base.assets[0],category:'MUSIC'}, {...base.assets[1],durationMs:0}]});
 assert.equal(o.audio[0].configured,false);
 assert.equal(o.audio[1].configured,false);
});
test('offline Windows Agent, missing binding and ESP32 do not pass',()=>{
 const o=assessMchsProductionAutoReadiness({...base,
  agent:{...base.agent,lastSeenAt:new Date(nowMs-30000).toISOString()},
  deviceBinding:{configured:false},esp32:null});
 assert.ok(o.holds.includes('PRODUCTION_AGENT_NOT_BOUND'));
 assert.ok(o.holds.includes('PRODUCTION_AGENT_OFFLINE'));
 assert.ok(o.holds.includes('ESP32_STATUS_NOT_CONFIRMED'));
});
test('unknown Worker journal health cannot be treated as ready',()=>{
 const o=assessMchsProductionAutoReadiness({...base,worker:{ok:true,data:{enabled:true}}});
 assert.ok(o.holds.includes('WORKER_TERMINAL_JOURNAL_UNHEALTHY'));
});
