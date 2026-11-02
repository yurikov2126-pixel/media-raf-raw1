import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceMchsDeviceCommand as advance} from '../src/lib/mchsDeviceCommandLedger.js';
const t=Date.parse('2026-11-03T12:00:00Z');
const event={type:'QUEUE_STOP',eventId:'event-1',eventType:'MISSILE_DANGER'};
test('STOP is queued, delivered and acknowledged with exact event binding',()=>{
 const first=advance({},event,{nowMs:t});
 assert.equal(first.ok,true);
 const sent=advance(first.state,{type:'DELIVER'},{nowMs:t+100});
 assert.equal(sent.command.action,'STOP');
 const rejected=advance(first.state,{type:'RECEIPT',receipt:{
  sequence:1,eventId:'other',eventType:'MISSILE_DANGER',action:'STOP',
  confirmed:true,playbackState:'STOPPED',localTrialStoppedConfirmed:true,confirmedAt:new Date(t+200).toISOString()}},{nowMs:t+200});
 assert.equal(rejected.ok,false);
 const accepted=advance(first.state,{type:'RECEIPT',receipt:{
  sequence:1,eventId:'event-1',eventType:'MISSILE_DANGER',action:'STOP',
  confirmed:true,playbackState:'STOPPED',localTrialStoppedConfirmed:true,confirmedAt:new Date(t+200).toISOString()}},{nowMs:t+200});
 assert.equal(accepted.ok,true);assert.equal(accepted.state.pending,null);
});
test('HALT cancels pending START while preserving STOP priority',()=>{
 const start={version:1,sequence:1,action:'START',eventId:'event-1'};
 const halted=advance({sequence:1,pending:start,halted:false},{type:'HALT'},{nowMs:t});
 assert.equal(halted.state.pending,null);
 const queued=advance(halted.state,event,{nowMs:t});
 assert.equal(queued.state.pending.action,'STOP');
});
test('outdated commands expire and automatic START is denied',()=>{
 const queued=advance({},event,{nowMs:t});
 assert.equal(advance(queued.state,{type:'DELIVER'},{nowMs:t+15001}).command,null);
 assert.equal(advance({}, {type:'QUEUE_START',eventId:'event-1'}, {nowMs:t}).ok,false);
});
