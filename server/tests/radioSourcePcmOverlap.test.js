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
