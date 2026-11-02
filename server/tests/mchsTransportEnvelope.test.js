import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMissileTransportEnvelope} from '../src/lib/mchsTransportEnvelope.js';
const now=Date.parse('2026-11-02T12:00:00Z');
const assessment={readyForFutureIntegration:true,holds:[],executionEnabled:false,publicBroadcastAuthorized:false};
const event={id:'evt',occurredAt:'2026-11-02T11:59:30Z'};
const command={idempotencyKey:'evt',eventType:'MISSILE_DANGER',audioAssetId:'alarm',repeats:3,mode:'DRY_RUN',speakerPlaybackEnabled:false};
test('envelope remains non-executable and expires after five seconds',()=>{
 const r=buildMissileTransportEnvelope({assessment,event,command,nowMs:now});
 assert.equal(r.reasons.length,0);assert.equal(r.transportEnabled,false);
 assert.equal(r.amplifierCommandEnabled,false);assert.equal(r.envelope.mode,'NOT_EXECUTABLE');
 assert.equal(Date.parse(r.envelope.expiresAt)-Date.parse(r.envelope.issuedAt),5000);
});
test('reject unsafe interlock, invalid event and repeated all-clear',()=>{
 for(const args of [
 {assessment:{...assessment,executionEnabled:true}},
 {event:{...event,id:'other'}},
 {event:{...event,occurredAt:'2026-11-02T11:55:00Z'}},
 {command:{...command,eventType:'MISSILE_ALL_CLEAR',repeats:3}}
 ]){
 const r=buildMissileTransportEnvelope({assessment,event,command,nowMs:now,...args});
 assert.equal(r.envelope,null);assert.ok(r.reasons.length>0);
 }
});
