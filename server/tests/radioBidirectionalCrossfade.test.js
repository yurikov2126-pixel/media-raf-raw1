import {describe,it,expect} from 'vitest';
import {RadioSourcePcmOverlap} from '../src/lib/radioSourcePcmOverlap.js';
import {readPcmFrames} from '../src/lib/radioLivePcmHandover.js';
import {planReverseHandover,verifyReverseHandoverCommit} from '../src/lib/radioReverseHandoverPlan.js';
const pcm=(value,frames)=>{const out=Buffer.alloc(frames*4);for(let i=0;i<out.length;i+=4){out.writeInt16LE(value,i);out.writeInt16LE(value,i+2);}return out;};
const iterator=(buffers)=>{let index=0;return {next:async()=>index<buffers.length?
  {value:buffers[index++],done:false}:{done:true}};};
describe.each([
 ['AUTO_DJ','SCHEDULED'],['SCHEDULED','AUTO_DJ']
])('real PCM frames %s → %s', (from,to)=>{
 it('streams an exact 1500ms overlap and preserves the remaining target PCM',async()=>{
  const overlap=new RadioSourcePcmOverlap({
   source:{id:'from',mode:from},target:{id:'to',mode:to},
   overlapMs:1500,curve:'equalPower'
  });
  expect(overlap.start({sourceReady:true,targetReady:true,slotAuthority:true}).ok).toBe(true);
  const target=iterator([pcm(1000,37),pcm(1000,82000)]);
  const out=[];
  let written=0;
  for(let n=0;n<75;n++){
   const incoming=await readPcmFrames(target,960,{deadlineMs:1500});
   const result=overlap.push(pcm(-1000,960),incoming);
   out.push(result.pcm);written+=result.frames;
  }
  expect(written).toBe(72000);
  expect(overlap.snapshot().phase).toBe('COMPLETED');
  const next=await readPcmFrames(target,480,{deadlineMs:1500});
  expect(next.length).toBe(1920);
  expect(Buffer.concat(out).length).toBe(1500*192);
  expect(overlap.snapshot().targetFrameOffset).toBe(72000);
 });
 it('refuses new mixed frames after a complete handover',()=>{
  const overlap=new RadioSourcePcmOverlap({
   source:{id:'from',mode:from},target:{id:'to',mode:to},overlapMs:250
  });
  overlap.start({sourceReady:true,targetReady:true,slotAuthority:true});
  expect(overlap.push(pcm(1,12000),pcm(2,12000)).status).toBe('COMPLETED');
  expect(()=>overlap.push(pcm(1,48),pcm(2,48))).toThrow('Overlap completed');
 });
});
describe('reverse reservation and identity',()=>{
 it('does not allow switched AutoDJ track during reverse handover',()=>{
  const plan=planReverseHandover({nowMs:10000,slotEndMs:20000,
   remainingMs:15000,overlapMs:1500,lastScheduledTrack:true,autoDjEnabled:true,
   target:{id:'reserved',seekMs:500},prepared:{assetId:'reserved',seekMs:500}});
  expect(plan.allowed).toBe(true);
  expect(verifyReverseHandoverCommit({plannedTargetId:'reserved',selectedTargetId:'changed',
   consumedFrames:72000,expectedFrames:72000}).allowed).toBe(false);
 });
});

import {reverseAuthorityFresh} from '../src/lib/radioPcmBoundaryClock.js';
describe('reverse authority survives PCM window entry',()=>{
 it('does not expire at 2218ms immediately before the overlap',()=>{
  expect(reverseAuthorityFresh({confirmedAtMs:10000,nowMs:12218,boundaryMs:15000})).toBe(true);
 });
 it('expires on an old, future, missing or past-boundary authority',()=>{
  expect(reverseAuthorityFresh({confirmedAtMs:10000,nowMs:13500,boundaryMs:15000})).toBe(false);
  expect(reverseAuthorityFresh({confirmedAtMs:10000,nowMs:9999,boundaryMs:15000})).toBe(false);
  expect(reverseAuthorityFresh({confirmedAtMs:null,nowMs:12218,boundaryMs:15000})).toBe(false);
  expect(reverseAuthorityFresh({confirmedAtMs:10000,nowMs:15000,boundaryMs:15000})).toBe(false);
 });
});
