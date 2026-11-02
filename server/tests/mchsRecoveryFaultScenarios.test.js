import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateMchsRecoveryFault} from '../src/lib/mchsRecoveryFaultScenarios.js';
const now=Date.parse('2026-11-02T10:00:00Z');
const command={commandId:'alarm-1',sourceEventId:'source-1',eventType:'MISSILE_DANGER',createdAt:new Date(now-1000).toISOString()};
const run=steps=>simulateMchsRecoveryFault({executionJournal:{state:'DANGER_ACTIVE'},steps,nowMs:now});
test('API and Worker restart never resume a previous alert',()=>{
 const x=run([{type:'STAGE',command},{type:'API_RESTART'},{type:'WORKER_RESTART'}]);
 assert.equal(x.journal.state,'INTERRUPTED');
 assert.equal(x.chain.status,'NOT_READY');
 assert.equal(x.dispatchAuthorized,false);
 assert.equal(x.automaticPlaybackEnabled,false);
});
test('reconnect does not restart or re-stage a duplicate alert',()=>{
 const x=run([{type:'STAGE',command},{type:'LINK_LOST'},{type:'LINK_RESTORED'},{type:'STAGE',command}]);
 assert.equal(x.history.at(-1).result,'DUPLICATE');
 assert.equal(x.protocol.commands.length,1);
 assert.equal(x.chain.dispatchAuthorized,false);
});
test('HALT prevents late dry-run ACK after reconnected agent',()=>{
 const x=run([{type:'STAGE',command},{type:'LINK_LOST'},{type:'HALT'},
  {type:'LINK_RESTORED'},{type:'DRY_RUN_ACK',command:{commandId:'alarm-1',sourceEventId:'source-1'}}]);
 assert.equal(x.protocol.commands[0].status,'HALTED');
 assert.equal(x.history.at(-1).result,'NOT_STAGED');
});
test('expired command cannot be acknowledged or replayed after restart',()=>{
 const x=run([{type:'STAGE',command},{type:'API_RESTART'},
  {type:'DRY_RUN_ACK',command:{commandId:'alarm-1',sourceEventId:'source-1'},atMs:now+121000},
  {type:'STAGE',command,atMs:now+121000}]);
 assert.equal(x.protocol.commands[0].status,'EXPIRED');
 assert.equal(x.history.at(-1).result,'DUPLICATE');
 assert.equal(x.paOutputVerified,false);
});
test('unknown and repeated faults have bounded log and never authorize transport',()=>{
 const steps=Array.from({length:200},(_,i)=>({type:i%2?'LINK_LOST':'WORKER_RESTART'}));
 const x=run(steps);
 assert.equal(x.history.length,100);
 assert.ok(x.history.every(v=>v.dispatchAuthorized===false));
 assert.equal(x.chain.status,'NOT_READY');
});
