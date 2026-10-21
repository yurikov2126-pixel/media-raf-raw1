import {describe,it,expect} from 'vitest';
import {createHandoverSession,mixDualDeckPcm,normalizeHandover} from '../src/lib/radioDualDeckPcm.js';
const frame=(n,count=48)=>{const b=Buffer.alloc(count*4);for(let i=0;i<b.length;i+=4){b.writeInt16LE(n,i);b.writeInt16LE(n,i+2);}return b;};
const config={overlapMs:250,curve:'linear'};
describe('Dual-deck PCM handover',()=>{
 it('validates overlap bounds and curve',()=>{
  expect(()=>normalizeHandover({overlapMs:6000,curve:'linear'})).toThrow();
  expect(()=>normalizeHandover({overlapMs:250,curve:'bogus'})).toThrow();
 });
 it('takes the beginning from A and ending from B, with bounded gain',()=>{
  const a=frame(10000,12000),b=frame(-10000,12000);
  const result=mixDualDeckPcm(a,b,config);
  expect(result.status).toBe('MIXED');
  expect(result.pcm.readInt16LE(0)).toBe(10000);
  expect(result.pcm.readInt16LE(result.pcm.length-4)).toBe(-10000);
 });
 it('maintains frame continuity across chunk boundaries without double-counting',()=>{
  const session=createHandoverSession(config);
  let count=0;
  for(let i=0;i<250;i++){
   const mixed=session.write(frame(700,48),frame(900,48));
   expect(mixed.frames).toBe(48);
   count+=mixed.frames;
  }
  expect(count).toBe(12000);
  expect(session.snapshot()).toMatchObject({closed:true,remainingFrames:0});
  expect(()=>session.write(frame(1),frame(2))).toThrow();
 });
 it('never fabricates a missing deck or replays previous PCM',()=>{
  const original=frame(1234,48);
  const session=createHandoverSession(config);
  expect(session.write(original,null)).toMatchObject({status:'OUTGOING_ONLY',frames:48});
  const incoming=frame(-4567,48);
  expect(session.write(null,incoming).pcm).toEqual(incoming);
  expect(session.snapshot().offsetFrames).toBe(96);
 });
 it('clamps full-scale summed samples without integer overflow',()=>{
  const result=mixDualDeckPcm(frame(32000,12000),frame(32000,12000),{overlapMs:250,curve:'equalPower'});
  expect(result.pcm.readInt16LE(24000)).toBe(32767);
 });
 it('rejects broken frame lengths and mismatched deck packet sizes',()=>{
  expect(()=>mixDualDeckPcm(Buffer.alloc(3),frame(10),config)).toThrow();
  expect(()=>mixDualDeckPcm(frame(10),frame(10,24),config)).toThrow();
 });
});

describe('live sCurve level behavior',()=>{
 it('keeps an equal-amplitude in-phase crossover at the input level',()=>{
  const pcm=mixDualDeckPcm(frame(22000,12000),frame(22000,12000),{overlapMs:250,curve:'sCurve'}).pcm;
  expect(pcm.readInt16LE(0)).toBe(22000);
  expect(pcm.readInt16LE(24000)).toBe(22000);
  expect(pcm.readInt16LE(pcm.length-4)).toBe(22000);
 });
 it('starts and ends with a gentle envelope',()=>{
  const pcm=mixDualDeckPcm(frame(16000,12000),frame(0,12000),{overlapMs:250,curve:'sCurve'}).pcm;
  expect(pcm.readInt16LE(0)).toBe(16000);
  expect(Math.abs(pcm.readInt16LE(4)-pcm.readInt16LE(0))).toBeLessThanOrEqual(1);
  expect(Math.abs(pcm.readInt16LE(pcm.length-4))).toBeLessThanOrEqual(1);
 });
});
