import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEsp32ReportSnapshot} from '../src/lib/mchsEsp32ReportSnapshot.js';
import {assessMchsMainStationReadiness} from '../src/lib/mchsMainStationReadiness.js';
const nowMs=Date.parse('2026-11-06T10:10:00.000Z');
const observedAt=new Date(nowMs-1000).toISOString();
const firmware={
 device:'MEDIA_RAF_RAW_ESP32',mode:'POWER_CONTROL_V1',
 agentMode:'CENTRAL',amplifierPower:'OFF_COMMANDED',relayOutputEnabled:true,
 bootNonce:'0123456789abcdef',heartbeatFresh:true,leaseValid:false,
 heartbeatCount:102,relayOnTransitions:1,relayOffTransitions:1,
 relayTransitionSequence:2,relayTransitionHistory:[
  {seq:1,uptimeMs:1000,on:true,reason:'SIGNED_POWER_PERMIT'},
  {seq:2,uptimeMs:4000,on:false,reason:'POWER_LEASE_EXPIRED'}
 ],lastRelayOffReason:'POWER_LEASE_EXPIRED'
};
const options={observedAt,reporterId:'agent1',agentPowerEvidence:[]};
test('new ESP32 firmware and Windows Agent diagnostics are independently reported',()=>{
 const snapshot=buildEsp32ReportSnapshot(firmware,options);
 assert.equal(snapshot.firmwareHistoryReported,true);
 assert.equal(snapshot.agentPowerEvidenceReported,true);
 assert.equal(snapshot.relayTransitionSequence,2);
 assert.equal(snapshot.lastRelayOffReason,'POWER_LEASE_EXPIRED');
});
test('empty event batches still prove Agent diagnostic protocol support',()=>{
 const snapshot=buildEsp32ReportSnapshot(firmware,options);
 assert.equal(snapshot.agentPowerEvidenceReported,true);
 assert.equal(snapshot.firmwareHistoryReported,true);
});
test('legacy ESP32 firmware or Agent without optional diagnostics cannot look upgraded',()=>{
 const snapshot=buildEsp32ReportSnapshot({...firmware,
  relayTransitionSequence:undefined,relayTransitionHistory:undefined},
  {observedAt,reporterId:'agent1'});
 assert.equal(snapshot.firmwareHistoryReported,false);
 assert.equal(snapshot.agentPowerEvidenceReported,false);
});
test('malformed ring cannot falsely prove firmware path',()=>{
 const snapshot=buildEsp32ReportSnapshot({...firmware,
  relayTransitionHistory:[{seq:2,uptimeMs:4000,on:false,reason:'INVALID_REASON'}]},options);
 assert.equal(snapshot.firmwareHistoryReported,false);
 assert.equal(snapshot.agentPowerEvidenceReported,true);
});
test('overlong Agent batch is not accepted as proof of diagnostic path',()=>{
 const snapshot=buildEsp32ReportSnapshot(firmware,{...options,
  agentPowerEvidence:Array.from({length:17},()=>({}))});
 assert.equal(snapshot.agentPowerEvidenceReported,false);
});
test('readiness reports transport support but never confirms physically audible PA',()=>{
 const snapshot=buildEsp32ReportSnapshot(firmware,options);
 const r=assessMchsMainStationReadiness({nowMs,deviceId:'agent1',
  esp32Status:{esp1:snapshot},device:{
   id:'agent1',lastSeenAt:new Date(nowMs-500),revokedAt:null,playbackAllowed:true
  }});
 assert.equal(r.esp32.firmwareHistoryReported,true);
 assert.equal(r.esp32.agentPowerEvidenceReported,true);
 assert.equal(r.readyForLivePA,false);
 assert.equal(r.physicalOutputConfirmed,false);
});
