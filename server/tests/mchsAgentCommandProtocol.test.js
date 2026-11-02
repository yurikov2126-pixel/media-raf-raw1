import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMchsAgentCommand,assessMchsAgentCommandReceipt} from '../src/lib/mchsAgentCommandProtocol.js';
const now=Date.parse('2026-11-03T12:00:00Z');
const cmd={version:1,action:'START',sequence:10,eventId:'e-123',
 eventType:'MISSILE_DANGER',assetId:'alarm',repeats:2,officialSourceVerified:true,
 createdAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+15000).toISOString()};
test('event-scoped command rejects replay, expiry, HALT and unverified sources',()=>{
 assert.equal(validateMchsAgentCommand(cmd,{nowMs:now,halted:false}).accepted,true);
 for(const opts of [{halted:true},{halted:false,lastSequence:10}]){
  assert.equal(validateMchsAgentCommand(cmd,{nowMs:now,...opts}).accepted,false);
 }
 assert.equal(validateMchsAgentCommand({...cmd,officialSourceVerified:false},{nowMs:now,halted:false}).accepted,false);
 assert.equal(validateMchsAgentCommand({...cmd,expiresAt:new Date(now-1000).toISOString()},{nowMs:now,halted:false}).accepted,false);
});
test('event scoped STOP remains valid while HALT active',()=>{
 const stop={...cmd,action:'STOP'};
 assert.equal(validateMchsAgentCommand(stop,{nowMs:now,halted:true}).accepted,true);
});
test('receipts require matching command and fresh playback state',()=>{
 const receipt={version:1,action:'START',sequence:10,eventId:'e-123',
  eventType:'MISSILE_DANGER',confirmed:true,playbackState:'ACTIVE',
  confirmedAt:new Date(now).toISOString()};
 assert.equal(assessMchsAgentCommandReceipt(cmd,receipt,{nowMs:now}).confirmed,true);
 assert.equal(assessMchsAgentCommandReceipt(cmd,{...receipt,sequence:9},{nowMs:now}).confirmed,false);
 assert.equal(assessMchsAgentCommandReceipt(cmd,{...receipt,playbackState:'STOPPED'},{nowMs:now}).confirmed,false);
});
