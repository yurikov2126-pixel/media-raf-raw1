import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeExecutionJournal,appendExecutionJournal,recoverExecutionJournal} from '../src/lib/mchsExecutionJournal.js';
test('unknown and malformed state fails closed',()=>{
 const state=normalizeExecutionJournal({state:'BROADCAST',entries:[null]});
 assert.equal(state.state,'HALTED');assert.equal(state.automaticPlaybackEnabled,false);
});
test('a restart cannot silently resume a pending danger or clear',()=>{
 for(const state of ['DANGER_PENDING','DANGER_ACTIVE','CLEAR_PENDING']){
  const x=recoverExecutionJournal({state});
  assert.equal(x.state,'INTERRUPTED');
  assert.equal(x.entries.at(-1).action,'RECOVERY_HOLD');
  assert.equal(x.executionEnabled,false);
 }
});
test('journal remains bounded, HALT remains HALT',()=>{
 let x={state:'HALTED'};
 for(let i=0;i<70;i++)x=appendExecutionJournal(x,{action:'OPERATOR_HALT'});
 assert.equal(x.entries.length,50);
 assert.equal(recoverExecutionJournal(x).state,'HALTED');
});
