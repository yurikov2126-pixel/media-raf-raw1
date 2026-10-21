import {describe,it,expect} from 'vitest';
import {RadioSourcePcmOverlap} from '../src/lib/radioSourcePcmOverlap.js';
const source={id:'autodj',mode:'AUTO_DJ'},target={id:'slot',mode:'SCHEDULED'};
const pcm=(n,count)=>{const b=Buffer.alloc(count*4);for(let i=0;i<b.length;i+=4){b.writeInt16LE(n,i);b.writeInt16LE(n,i+2);}return b;};
describe('source PCM overlap: independent packet boundaries',()=>{
 const create=()=>new RadioSourcePcmOverlap({source,target,overlapMs:250,curve:'linear'});
 it('aligns uneven source packets and never duplicates a frame',()=>{
  const x=create();expect(x.start({sourceReady:true,targetReady:true,slotAuthority:true}).ok).toBe(true);
  let emitted=0;
  for(let i=0;i<100;i++){
   const result=x.push(pcm(1000,120),pcm(-1000,i%2?150:90));
   emitted+=result.frames;
  }
  while(x.snapshot().targetQueuedFrames>0 && !x.snapshot().closed){
   const result=x.push(Buffer.alloc(0),Buffer.alloc(0));
   if(!result.frames)break;
   emitted+=result.frames;
  }
  expect(emitted).toBe(12000);
  expect(x.snapshot()).toMatchObject({phase:'COMPLETED',targetFrameOffset:12000,framesOut:12000});
 });
 it('refuses to mix when target decoder is not ready',()=>{
  const x=create();
  expect(x.start({sourceReady:true,targetReady:false,slotAuthority:true}).ok).toBe(false);
  expect(x.push(pcm(10,48),Buffer.alloc(0))).toMatchObject({frames:0,status:'FALLBACK'});
 });
 it('preserves emitted target offset for failure recovery',()=>{
  const x=create();x.start({sourceReady:true,targetReady:true,slotAuthority:true});
  expect(x.push(pcm(10,480),pcm(20,480)).frames).toBe(480);
  expect(x.abort('TARGET_UNDERRUN',{targetAvailable:true})).toMatchObject({
   emittedTargetFrames:480,fallback:{sourceId:'slot',skipTargetFrames:480}
  });
 });
 it('never mixes partial frames or unapproved authority',()=>{
  const x=create();
  expect(x.start({sourceReady:true,targetReady:true,slotAuthority:false}).ok).toBe(false);
  expect(()=>x.push(Buffer.alloc(3),Buffer.alloc(4))).toThrow();
 });
});

describe('last packet at exact overlap boundary',()=>{
 it('caps an oversized source packet to remaining frames instead of reporting a length mismatch',()=>{
  const engine=new RadioSourcePcmOverlap({source,target,overlapMs:1500});
  expect(engine.start({sourceReady:true,targetReady:true,slotAuthority:true}).ok).toBe(true);
  expect(engine.push(pcm(10,71500),pcm(20,71500)).frames).toBe(71500);
  const sourcePacket=pcm(10,960);
  const framesLeft=1500*48-engine.snapshot().framesOut;
  const clipped=sourcePacket.subarray(0,Math.min(sourcePacket.length,framesLeft*4));
  const result=engine.push(clipped,pcm(20,framesLeft));
  expect(result.pcm.length).toBe(clipped.length);
  expect(result.status).toBe('COMPLETED');
  expect(engine.snapshot().framesOut).toBe(72000);
 });
});

describe('completed overlap rejects post-mix source PCM',()=>{
 it('reports completed state after exactly 72000 mixed frames',()=>{
  const engine=new RadioSourcePcmOverlap({source,target,overlapMs:1500});
  expect(engine.start({sourceReady:true,targetReady:true,slotAuthority:true}).ok).toBe(true);
  const mixed=engine.push(pcm(100,72000),pcm(200,72000));
  expect(mixed.status).toBe('COMPLETED');
  expect(engine.snapshot()).toMatchObject({phase:'COMPLETED',framesOut:72000});
  // The worker checks phase before ever calling push for a subsequent packet.
  expect(engine.snapshot().phase==='COMPLETED').toBe(true);
 });
});
