import {describe,it,expect} from 'vitest';
import {readPcmFrames,writeLivePcmHandover} from '../src/lib/radioLivePcmHandover.js';
const pcm=(value,frames)=>{const buf=Buffer.alloc(frames*4);for(let i=0;i<buf.length;i+=4){buf.writeInt16LE(value,i);buf.writeInt16LE(value,i+2);}return buf;};
function reader(parts){let i=0;return {next:async()=>i<parts.length?{done:false,value:parts[i++]}:{done:true}};}
const source={id:'auto',mode:'AUTO_DJ'},target={id:'show',mode:'SCHEDULED'};
describe('live PCM writer contract',()=>{
 it('commits exactly one 250ms stereo overlap through output writer',async()=>{
  const written=[];
  const result=await writeLivePcmHandover({outgoing:pcm(5000,12000),
   incomingIterator:reader([pcm(-5000,173),pcm(-5000,6000),pcm(-5000,5827)]),
   source,target,overlapMs:250,curve:'linear',authorized:true,chunkFrames:960,
   write:async b=>written.push(Buffer.from(b))});
  const joined=Buffer.concat(written);
  expect(result).toMatchObject({status:'MIXED',targetFramesConsumed:12000,writtenFrames:12000});
  expect(joined.length).toBe(48000);
  expect(joined.readInt16LE(0)).toBe(5000);
  expect(joined.readInt16LE(joined.length-4)).toBe(-5000);
 });
 it('rejects insufficient incoming audio before writing ANY overlap PCM',async()=>{
  const written=[];
  await expect(writeLivePcmHandover({outgoing:pcm(800,12000),
   incomingIterator:reader([pcm(100,5000)]),source,target,overlapMs:250,
   authorized:true,write:async b=>written.push(b)})).rejects.toThrow('TARGET_PCM_UNDERRUN');
  expect(written).toHaveLength(0);
 });
 it('rejects revoked authority before consuming target data',async()=>{
  let calls=0;
  await expect(writeLivePcmHandover({outgoing:pcm(900,12000),
   incomingIterator:{next:async()=>{calls++;return {done:true};}},source,target,
   overlapMs:250,authorized:false,write:async()=>{}})).rejects.toThrow('SOURCE_AUTHORITY_REVOKED');
  expect(calls).toBe(0);
 });
 it('never retries already submitted PCM after an output write error',async()=>{
  let writes=0;
  await expect(writeLivePcmHandover({outgoing:pcm(900,12000),
   incomingIterator:reader([pcm(300,12000)]),source,target,overlapMs:250,
   authorized:true,write:async()=>{writes++;throw new Error('ENCODER_DOWN');}}))
    .rejects.toThrow('ENCODER_DOWN');
  expect(writes).toBe(1);
 });
 it('leaves excess target frames available to the next reader',async()=>{
  const it=reader([pcm(800,600),pcm(900,600)]);
  expect((await readPcmFrames(it,480)).length).toBe(1920);
  const rest=await readPcmFrames(it,720);
  expect(rest.readInt16LE(0)).toBe(800);
  expect(rest.readInt16LE(120*4)).toBe(900);
 });
});
