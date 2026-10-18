import {describe,it,expect} from 'vitest';
import {RadioWorkerSwitchShadow} from '../src/lib/radioWorkerSwitchShadow.js';
const ready={scheduleKnown:true,scheduleRevision:9,scheduledActive:false,
  sessionValid:true,leaseId:'lease-1',pcmHealthy:true,bufferReady:true};
function fixture(){let now=1000;return {engine:new RadioWorkerSwitchShadow({clock:()=>now,ttlMs:1000,maxEvents:4}),
 advance:ms=>{now+=ms;}};}
describe('Worker-side radio switch shadow',()=>{
 it('validates a stable session/revision without ever switching audio',()=>{
  const {engine}=fixture(),p=engine.prepare(ready);
  expect(p.ok).toBe(true);
  expect(engine.verify({proposalId:p.proposalId,input:ready}))
    .toMatchObject({ok:true,connectedToEncoder:false,changeApplied:false});
  expect(engine.snapshot().mode).toBe('SHADOW_ONLY');
 });
 it('rejects a changed schedule, replaced lease and expired proposal',()=>{
  for(const diff of [{scheduleRevision:10},{leaseId:'lease-2'}]){
   const {engine}=fixture(),p=engine.prepare(ready);
   expect(engine.verify({proposalId:p.proposalId,input:{...ready,...diff}}).reason).toBe('FENCE_CHANGED');
  }
  const {engine,advance}=fixture(),p=engine.prepare(ready);advance(1001);
  expect(engine.verify({proposalId:p.proposalId,input:ready}).reason).toBe('EXPIRED');
 });
 it('fails closed for schedule conflict, missing session and PCM instability',()=>{
  const {engine}=fixture();
  for(const diff of [{scheduledActive:true},{sessionValid:false},{bufferReady:false},{pcmHealthy:false}]){
   expect(engine.prepare({...ready,...diff}).ok).toBe(false);
  }
  expect(engine.snapshot().connectedToEncoder).toBe(false);
 });
 it('bounds journal, cancels sessions, and records advisory Auto-DJ fallback',()=>{
  const {engine}=fixture();engine.prepare(ready);engine.cancel('PRESENTER_DISCONNECT');
  engine.prepare(ready);engine.fallback('PCM_STALE');
  engine.prepare(ready);engine.cancel('SCHEDULE_CHANGED');
  const snap=engine.snapshot();
  expect(snap.events.length).toBeLessThanOrEqual(4);
  expect(snap.fallbacks).toBe(1);
  expect(snap.changeApplied).toBe(false);
  expect(snap.pending).toBe(false);
 });
});
