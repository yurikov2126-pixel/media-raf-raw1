import test from 'node:test';
import assert from 'node:assert/strict';
import {stageMchsDispatchCommand,haltMchsDispatchProtocol,normalizeMchsDispatchProtocol,recordMchsDispatchDryRunAck} from '../src/lib/mchsDispatchProtocol.js';
const now=Date.parse('2026-11-02T10:00:00Z');
test('HALT provides a persistent epoch and never authorizes output',()=>{
 const staged=stageMchsDispatchCommand(null,{commandId:'cmd-1',sourceEventId:'event-1',eventType:'MISSILE_DANGER',createdAt:new Date(now-1000).toISOString()},now);
 const halted=haltMchsDispatchProtocol(staged.state,now);
 assert.equal(halted.haltEpoch,new Date(now).toISOString());
 assert.equal(normalizeMchsDispatchProtocol(JSON.parse(JSON.stringify(halted))).haltEpoch,halted.haltEpoch);
 assert.equal(halted.commands[0].status,'HALTED');
 assert.equal(halted.dispatchAuthorized,false);
 assert.equal(halted.executionEnabled,false);
 assert.equal(recordMchsDispatchDryRunAck(halted,{commandId:'cmd-1',sourceEventId:'event-1'},now).accepted,false);
});
test('repeated HALT advances epoch without unlocking protocol',()=>{
 const a=haltMchsDispatchProtocol(null,now);
 const b=haltMchsDispatchProtocol(a,now+1000);
 assert.notEqual(a.haltEpoch,b.haltEpoch);
 assert.equal(b.halted,true);
 assert.equal(b.executionEnabled,false);
});
test('missing or corrupt HALT epoch fails closed',()=>{
 assert.equal(normalizeMchsDispatchProtocol({haltEpoch:'bad',halted:false}).haltEpoch,null);
 assert.equal(normalizeMchsDispatchProtocol({haltEpoch:'bad',halted:false}).halted,true);
});
