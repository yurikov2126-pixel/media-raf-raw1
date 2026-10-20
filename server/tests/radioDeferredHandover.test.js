import {describe,it,expect} from 'vitest';
import {completeDeferredHandover} from '../src/lib/radioDeferredHandover.js';
const samples=(n)=>{const b=Buffer.alloc(250*192);for(let i=0;i<b.length;i+=4){b.writeInt16LE(n,i);b.writeInt16LE(n,i+2);}return b;};
const pair={source:{id:'auto',mode:'AUTO_DJ'},target:{id:'scheduled',mode:'SCHEDULED'},overlapMs:250,curve:'linear'};
describe('held boundary PCM once-only commit',()=>{
 it('uses exact incoming prefix and returns its consumed frames',()=>{
  const a=samples(8000),b=samples(-8000);
  const result=completeDeferredHandover({...pair,tail:a,incoming:b});
  expect(result.status).toBe('MIXED');
  expect(result.targetFramesConsumed).toBe(12000);
  expect(result.pcm.readInt16LE(0)).toBe(8000);
  expect(result.pcm.readInt16LE(result.pcm.length-4)).toBe(-8000);
 });
 it('flushes only outgoing PCM when target is missing',()=>{
  const a=samples(2000);
  expect(completeDeferredHandover({...pair,tail:a,incoming:null}))
   .toMatchObject({pcm:a,status:'OUTGOING_FALLBACK',targetFramesConsumed:0});
 });
 it('blocks mixing when authority has been revoked',()=>{
  const a=samples(100),b=samples(-100);
  expect(completeDeferredHandover({...pair,tail:a,incoming:b,authority:false}).status)
   .toBe('OUTGOING_FALLBACK');
 });
 it('rejects a partially sized held window rather than altering timeline',()=>{
  expect(()=>completeDeferredHandover({...pair,tail:Buffer.alloc(4),incoming:samples(10)}))
   .toThrow(/window/);
 });
});
