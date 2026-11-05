import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createMchsStationTerminalJournal} from '../src/lib/mchsStationTerminalJournal.js';
import {createMchsStationPcmExecutor} from '../src/lib/mchsStationPcmExecutor.js';
import {registerStationDispatch,reconcileStationReceiptHistory} from '../src/lib/mchsStationExecutionReceipts.js';
const terminal=(eventId,phase='COMPLETE')=>({eventId,eventType:'MISSILE_DANGER',assetId:'a1',
 repeats:1,completedRepeats:phase==='COMPLETE'?1:0,preemptAcknowledged:true,
 naturalCompletion:phase==='COMPLETE',programRestored:phase==='COMPLETE',phase,failure:null});
test('fsynced terminal entry survives Worker restart and populates durable API receipt',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'mchs-journal-'));
 try{
  const file=path.join(dir,'audit.jsonl'),first=createMchsStationTerminalJournal(file);
  assert.equal(first.status().healthy,true);
  assert.equal(first.append(terminal('event1')).ok,true);
  const restarted=createMchsStationTerminalJournal(file);
  assert.equal(restarted.history().length,1);
  assert.equal(restarted.hasEvent('event1'),true);
  const pending=registerStationDispatch(null,[{eventId:'event1',ok:true}]);
  const result=reconcileStationReceiptHistory(pending,{ok:true,data:{
   phase:'IDLE',session:null,terminalHistory:restarted.history()}});
  assert.equal(result.ledger.items[0].state,'COMPLETE');
  assert.equal(restarted.append(terminal('event1')).ok,false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('PCM executor persists natural completion and FAILED, without STOP',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'mchs-worker-'));
 try{
  const journal=createMchsStationTerminalJournal(path.join(dir,'audit.jsonl'));
  const executor=createMchsStationPcmExecutor({onTerminal:r=>journal.append(r)});
  const pcm=()=>({size:4,read:()=>Buffer.from([1,0,1,0]),close:()=>{}});
  assert.equal(executor.prepare({eventId:'e1',eventType:'MISSILE_DANGER',assetId:'a1',
   repeats:1,pcm:pcm()}).ok,true);
  executor.replace(Buffer.alloc(4));
  executor.observeProgram(Buffer.from([1,0,1,0]));
  assert.equal(journal.history()[0].phase,'COMPLETE');
  assert.equal(executor.prepare({eventId:'e2',eventType:'MISSILE_DANGER',assetId:'a1',
   repeats:1,pcm:pcm()}).ok,true);
  executor.abort('PCM_ERROR');
  assert.equal(journal.history()[1].phase,'FAILED');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('corrupt or torn log refuses fresh START auditing, never fabricates success',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'mchs-corrupt-'));
 try{
  const file=path.join(dir,'audit.jsonl');
  appendFileSync(file,'{"eventId":"broken"');
  const journal=createMchsStationTerminalJournal(file);
  assert.equal(journal.status().healthy,false);
  assert.equal(journal.append(terminal('event1')).ok,false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
