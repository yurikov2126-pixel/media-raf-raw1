import {describe,it,expect} from 'vitest';
import {RadioSourceOutputCommit} from '../src/lib/radioSourceOutputCommit.js';
const pcm=(value,frames)=>{const b=Buffer.alloc(frames*4);for(let i=0;i<b.length;i+=4){b.writeInt16LE(value,i);b.writeInt16LE(value,i+2);}return b;};
const source={id:'auto',mode:'AUTO_DJ'},target={id:'show',mode:'SCHEDULED'};
describe('station output commit before persistent encoder',()=>{
 it('commits outgoing head and exactly one mixed tail',async()=>{
  const chunks=[];
  const gate=new RadioSourceOutputCommit({overlapMs:250,curve:'linear',write:async c=>chunks.push(Buffer.from(c))});
  const input=pcm(10000,24000);
  await gate.accept(input);
  const report=await gate.finish({source,target,incoming:pcm(-10000,12000),authorized:true});
  expect(report).toMatchObject({status:'MIXED',targetFramesConsumed:12000,emittedBytes:96000});
  const emitted=Buffer.concat(chunks);
  expect(emitted.length).toBe(input.length);
  expect(emitted.readInt16LE(0)).toBe(10000);
  expect(emitted.readInt16LE(emitted.length-4)).toBe(-10000);
  await expect(gate.finish()).rejects.toThrow(/Already committed/);
 });
 it('flushes original outgoing PCM if target is not ready or unauthorized',async()=>{
  for(const auth of [false,true]){
   const chunks=[];
   const gate=new RadioSourceOutputCommit({overlapMs:250,write:async c=>chunks.push(Buffer.from(c))});
   const input=pcm(700,17000);
   await gate.accept(input);
   const report=await gate.finish({source,target,incoming:auth?null:pcm(900,12000),authorized:auth});
   expect(report.targetFramesConsumed).toBe(0);
   expect(report.status).toBe('OUTGOING_FALLBACK');
   expect(Buffer.concat(chunks)).toEqual(input);
  }
 });
 it('does not replay a possibly partially accepted encoder write',async()=>{
  let calls=0;
  const gate=new RadioSourceOutputCommit({overlapMs:250,write:async()=>{calls++;throw new Error('broken encoder');}});
  await gate.accept(pcm(200,100));
  await expect(gate.finish()).rejects.toThrow('broken encoder');
  expect(gate.snapshot().state).toBe('OUTPUT_FAILED');
  await expect(gate.finish()).rejects.toThrow('Already committed');
  expect(calls).toBe(1);
 });
 it('retains exact bytes when source shorter than overlap window',async()=>{
  const chunks=[];
  const gate=new RadioSourceOutputCommit({overlapMs:250,write:async c=>chunks.push(Buffer.from(c))});
  await gate.accept(pcm(12,480));
  const r=await gate.finish({authorized:true,source,target,incoming:pcm(10,12000)});
  expect(r).toMatchObject({status:'OUTGOING_FALLBACK',targetFramesConsumed:0});
  expect(Buffer.concat(chunks).length).toBe(1920);
 });
});
