import {describe,it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {rehearseSourceOverlap} from '../src/lib/radioSourceOverlapRehearsal.js';
const available=spawnSync('ffmpeg',['-version'],{stdio:'ignore'}).status===0;
function wav(value,ms=500){
 const frames=48*ms,body=Buffer.alloc(frames*4);
 for(let i=0;i<body.length;i+=4){body.writeInt16LE(value,i);body.writeInt16LE(value,i+2);}
 const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(body.length+36,4);
 header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);
 header.writeUInt16LE(2,22);header.writeUInt32LE(48000,24);header.writeUInt32LE(192000,28);
 header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);
 header.writeUInt32LE(body.length,40);return Buffer.concat([header,body]);
}
describe.skipIf(!available)('offline two-source FFmpeg rehearsal',()=>{
 it('decodes both sources, mixes exactly 250 ms and does not touch public encoder',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'radio-overlap-'));
  try{
   const a=path.join(root,'auto.wav'),b=path.join(root,'show.wav');
   await Promise.all([writeFile(a,wav(9000)),writeFile(b,wav(-9000))]);
   const result=await rehearseSourceOverlap({sourcePath:a,targetPath:b,overlapMs:250});
   expect(result.metrics).toMatchObject({status:'COMPLETED',frames:12000,streamedToPublicEncoder:false});
   expect(result.pcm.length).toBe(48000);
   expect(result.pcm.readInt16LE(0)).toBe(9000);
   expect(result.pcm.readInt16LE(result.pcm.length-4)).toBe(-9000);
  }finally{await rm(root,{recursive:true,force:true});}
 });
 it('decodes reverse schedule-to-AutoDJ sound with the same exact frame window',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'radio-reverse-'));
  try{
   const a=path.join(root,'show.wav'),b=path.join(root,'auto.wav');
   await Promise.all([writeFile(a,wav(15000)),writeFile(b,wav(-12000))]);
   const result=await rehearseSourceOverlap({sourcePath:a,targetPath:b,
    sourceId:'SCHEDULED',targetId:'AUTO_DJ',overlapMs:250});
   expect(result.metrics).toMatchObject({status:'COMPLETED',frames:12000,
    streamedToPublicEncoder:false});
   expect(result.pcm.readInt16LE(0)).toBe(15000);
   expect(result.pcm.readInt16LE(result.pcm.length-4)).toBe(-12000);
  }finally{await rm(root,{recursive:true,force:true});}
 });
 it('rejects a truncated second file rather than replaying previous audio',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'radio-overlap-'));
  try{
   const a=path.join(root,'auto.wav'),b=path.join(root,'short.wav');
   await Promise.all([writeFile(a,wav(9000,500)),writeFile(b,wav(-9000,100))]);
   await expect(rehearseSourceOverlap({sourcePath:a,targetPath:b,overlapMs:250}))
    .rejects.toThrow(/underrun/i);
  }finally{await rm(root,{recursive:true,force:true});}
 });
});
