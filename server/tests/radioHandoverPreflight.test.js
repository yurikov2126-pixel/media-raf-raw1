import {describe,it,expect} from 'vitest';
import {RadioHandoverPreflight} from '../src/lib/radioHandoverPreflight.js';
const healthy={scheduleKnown:true,scheduledActive:false,presenterAuthorized:true,
 presenterConnected:true,gatewayRunning:true,pcmReady:true,presenterId:'presenter-a',
 leaseId:'lease-a',scheduleRevision:4};
const setup=()=>{let now=1000,id=0;const p=new RadioHandoverPreflight({
 now:()=>now,idFactory:()=>String(++id),ttlMs:1000,maxJournal:3});
 return {p,setTime:t=>{now=t;}};};
describe('radio handover preflight: no on-air side effects',()=>{
 it('prepares and validates a fenced proposal without changing audio',()=>{
  const {p}=setup(),x=p.prepare(healthy);
  expect(x.ok).toBe(true);
  expect(p.validate(x.proposalId,healthy)).toMatchObject({ok:true,changeApplied:false});
  expect(p.snapshot().connectedToEncoder).toBe(false);
 });
 it('blocks schedule takeover even with healthy PCM',()=>{
  const {p}=setup();
  expect(p.prepare({...healthy,scheduledActive:true}).reason).toBe('SCHEDULE_PRIORITY');
  expect(p.prepare({...healthy,scheduleKnown:false}).reason).toBe('SCHEDULE_UNKNOWN');
  expect(p.snapshot().pending).toBe(false);
 });
 it('rejects stale lease, new presenter or schedule revision',()=>{
  for(const change of [{leaseId:'lease-b'},{presenterId:'presenter-b'},{scheduleRevision:5}]){
   const {p}=setup(),x=p.prepare(healthy);
   expect(p.validate(x.proposalId,{...healthy,...change}).reason).toBe('FENCE_MISMATCH');
   expect(p.snapshot().pending).toBe(false);
  }
 });
 it('expires uncommitted proposals, never commits after timeout',()=>{
  const {p,setTime}=setup(),x=p.prepare(healthy);
  setTime(2001);
  expect(p.validate(x.proposalId,healthy).reason).toBe('PROPOSAL_EXPIRED');
 });
 it('fails closed when PCM or authorization disappears',()=>{
  const {p}=setup(),x=p.prepare(healthy);
  expect(p.validate(x.proposalId,{...healthy,pcmReady:false}).reason).toBe('PCM_NOT_READY');
  expect(p.prepare({...healthy,presenterAuthorized:false}).ok).toBe(false);
 });
 it('records bounded history and only recommends Auto-DJ on failure',()=>{
  const {p}=setup();p.prepare(healthy);p.failover('CONNECTION_LOST');
  p.prepare(healthy);p.failover('PCM_STALE');
  const result=p.failover('DECODER_EXIT');
  expect(result).toEqual({recommendedSource:'AUTO_DJ',reason:'DECODER_EXIT',changeApplied:false});
  expect(p.snapshot().journal).toHaveLength(3);
 });
 it('refuses invalid versions and settings',()=>{
  const {p}=setup();
  expect(p.prepare({...healthy,scheduleRevision:null}).reason).toBe('SCHEDULE_REVISION_UNKNOWN');
  expect(()=>new RadioHandoverPreflight({ttlMs:0})).toThrow(TypeError);
 });
});
