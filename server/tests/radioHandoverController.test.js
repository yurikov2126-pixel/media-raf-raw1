import {describe,it,expect} from 'vitest';
import {RadioHandoverController} from '../src/lib/radioHandoverController.js';
const pair={source:{id:'auto'},target:{id:'schedule'},sourceReady:true,targetReady:true};
describe('dual source handover controller',()=>{
 it('allows only a ready and authoritative two-deck handover',()=>{
  const c=new RadioHandoverController({overlapMs:250});
  expect(c.reserve({...pair,targetReady:false})).toMatchObject({ok:false,reason:'TARGET_NOT_READY'});
  expect(c.start().ok).toBe(false);
  c.reset();
  expect(c.reserve({...pair,publicLive:true}).ok).toBe(false);
  expect(c.reserve(pair).ok).toBe(true);
  expect(c.reserve(pair)).toMatchObject({ok:false,reason:'ALREADY_RESERVED'});
  expect(c.start().ok).toBe(true);
 });
 it('commits exactly 12000 frames and never mixes twice',()=>{
  const c=new RadioHandoverController({overlapMs:250});
  c.reserve(pair);c.start();
  for(let i=0;i<250;i++)expect(c.commit(48).ok).toBe(true);
  expect(c.snapshot()).toMatchObject({phase:'COMPLETED',targetFrameOffset:12000});
  expect(c.commit(48).ok).toBe(false);
 });
 it('falls back after partial overlap without replaying target head',()=>{
  const c=new RadioHandoverController({overlapMs:1000});
  c.reserve(pair);c.start();
  c.commit(4800);
  expect(c.fail('DECODER_EXIT')).toMatchObject({fallback:{
   mode:'SINGLE_SOURCE',sourceId:'schedule',skipTargetFrames:4800}});
 });
 it('does not advance offset for failed commit or missing target',()=>{
  const c=new RadioHandoverController({overlapMs:250});
  c.reserve({...pair,targetReady:false});
  expect(c.safeFallback()).toMatchObject({sourceId:'auto',skipTargetFrames:0});
  c.reset();c.reserve(pair);c.start();
  expect(c.commit(12001)).toMatchObject({ok:false,reason:'INVALID_FRAME_COMMIT'});
  expect(c.snapshot().targetFrameOffset).toBe(0);
  expect(c.commit(48,{bothDecksEmitted:false}).reason).toBe('DECK_UNDERRUN');
 });
});
