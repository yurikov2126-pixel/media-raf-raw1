import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMchsAgentCommand,assessMchsAgentCommandReceipt} from '../src/lib/mchsAgentCommandProtocol.js';
const now=Date.parse('2026-11-03T12:00:00Z');
const stop={version:1,action:'STOP',sequence:2,eventId:'evt1',eventType:'MISSILE_DANGER',
 createdAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+5000).toISOString()};
test('server accepts STOP under HALT but never stale commands',()=>{
 assert.equal(validateMchsAgentCommand(stop,{nowMs:now,halted:true}).accepted,true);
 assert.equal(validateMchsAgentCommand(stop,{nowMs:now+6000,halted:true}).accepted,false);
});
test('STOP proof must be bound to event, sequence and STOPPED state',()=>{
 const receipt={version:1,action:'STOP',sequence:2,eventId:'evt1',eventType:'MISSILE_DANGER',
 confirmed:true,playbackState:'STOPPED',confirmedAt:new Date(now).toISOString()};
 assert.equal(assessMchsAgentCommandReceipt(stop,receipt,{nowMs:now}).confirmed,true);
 assert.equal(assessMchsAgentCommandReceipt(stop,{...receipt,eventId:'other'},{nowMs:now}).confirmed,false);
 assert.equal(assessMchsAgentCommandReceipt(stop,{...receipt,playbackState:'ACTIVE'},{nowMs:now}).confirmed,false);
});
