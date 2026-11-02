import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMchsDispatchProtocol,stageMchsDispatchCommand,recordMchsDispatchDryRunAck,haltMchsDispatchProtocol} from '../src/lib/mchsDispatchProtocol.js';
const now=Date.parse('2026-11-02T10:00:00Z');
const input={commandId:'cmd-1',sourceEventId:'source-1',eventType:'MISSILE_DANGER',createdAt:new Date(now-1000).toISOString()};
test('staging is fail-closed and idempotent by command and source',()=>{
 const first=stageMchsDispatchCommand(null,input,now);
 assert.equal(first.accepted,true);assert.equal(first.state.dispatchAuthorized,false);
 assert.equal(first.state.halted,true);
 assert.equal(stageMchsDispatchCommand(first.state,input,now).reason,'DUPLICATE');
 assert.equal(stageMchsDispatchCommand(first.state,{...input,commandId:'cmd-2'},now).reason,'DUPLICATE');
});
test('dry-run ack never proves actual playback and rejects repeats',()=>{
 const state=stageMchsDispatchCommand(null,input,now).state;
 const ack=recordMchsDispatchDryRunAck(state,{commandId:'cmd-1',sourceEventId:'source-1'},now);
 assert.equal(ack.accepted,true);assert.equal(ack.playbackVerified,false);
 assert.equal(ack.state.commands[0].status,'ACKED_DRY_RUN');
 assert.equal(recordMchsDispatchDryRunAck(ack.state,{commandId:'cmd-1',sourceEventId:'source-1'},now).reason,'DUPLICATE_ACK');
});
test('expired command cannot receive ack or be restaged with same event',()=>{
 const state=stageMchsDispatchCommand(null,input,now).state;
 const ack=recordMchsDispatchDryRunAck(state,{commandId:'cmd-1',sourceEventId:'source-1'},now+121000);
 assert.equal(ack.reason,'EXPIRED');assert.equal(ack.state.commands[0].status,'EXPIRED');
 assert.equal(stageMchsDispatchCommand(ack.state,input,now+121000).reason,'DUPLICATE');
});
test('persistent HALT cancels STAGED commands but cannot turn on execution',()=>{
 const state=stageMchsDispatchCommand(null,input,now).state;
 const halted=haltMchsDispatchProtocol(state,now+1000);
 assert.equal(halted.commands[0].status,'HALTED');
 assert.equal(recordMchsDispatchDryRunAck(halted,{commandId:'cmd-1',sourceEventId:'source-1'},now+1000).reason,'NOT_STAGED');
 assert.equal(halted.executionEnabled,false);
});
test('malformed state and invalid command are rejected',()=>{
 assert.equal(normalizeMchsDispatchProtocol({halted:false,commands:[null]}).halted,true);
 assert.equal(stageMchsDispatchCommand(null,{...input,eventType:'OTHER'},now).reason,'INVALID_COMMAND');
 assert.equal(stageMchsDispatchCommand(null,{...input,createdAt:new Date(now+60000).toISOString()},now).reason,'EXPIRED_OR_FUTURE');
});
