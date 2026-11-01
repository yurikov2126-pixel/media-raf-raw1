import test from 'node:test';
import assert from 'node:assert/strict';
import {createMchsCommandReceiptStore} from '../src/lib/mchsCommandReceiptStore.js';
const token='a'.repeat(48);
test('worker records a dry-run receipt without playing audio',()=>{
 const store=createMchsCommandReceiptStore();
 const result=store.receive({commandId:'event-1',eventType:'MISSILE_DANGER',leaseToken:token});
 assert.equal(result.ok,true);assert.equal(result.receipt.playbackStarted,false);
 assert.equal(result.receipt.status,'RECEIVED_DRY_RUN');
});
test('repeat receipt is idempotent',()=>{
 const store=createMchsCommandReceiptStore(),cmd={commandId:'x',eventType:'MISSILE_ALL_CLEAR',leaseToken:token};
 assert.equal(store.receive(cmd).duplicate,false);
 assert.equal(store.receive(cmd).duplicate,true);
});
test('reject unrelated commands',()=>{
 const store=createMchsCommandReceiptStore();
 assert.equal(store.receive({commandId:'x',eventType:'UAV_DANGER',leaseToken:token}).ok,false);
});
