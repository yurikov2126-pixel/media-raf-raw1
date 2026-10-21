import {describe,it,expect} from 'vitest';
import {RadioStationDualDeck} from '../src/lib/radioStationDualDeck.js';
const frame=(ms,value)=>{const b=Buffer.alloc(ms*192);for(let i=0;i<b.length;i+=2)b.writeInt16LE(value,i);return b;};
describe('station dual-deck PCM bus',()=>{
 it('mixes simultaneous stereo audio over multiple packets and resumes at exact offset',()=>{
  const bus=new RadioStationDualDeck({overlapMs:1500});
  expect(bus.begin({from:{id:'old',mode:'SCHEDULED'},to:{id:'new',mode:'AUTO_DJ'},
   sourceReady:true,targetReady:true,authority:true}).ok).toBe(true);
  let pcm=Buffer.alloc(0),last;
  for(const ms of [100,200,400,300,500]){
   last=bus.push(frame(ms,11000),frame(ms,7000));
   pcm=Buffer.concat([pcm,last.pcm]);
  }
  expect(pcm.length).toBe(1500*192);
  expect(last.status).toBe('COMPLETED');
  expect(last.continuation).toEqual({target:{id:'new',mode:'AUTO_DJ'},consumedFrames:72000,consumedMs:1500});
  expect(bus.active).toBe(false);
  expect(pcm.readInt16LE(0)).toBeGreaterThan(0);
  expect(pcm.readInt16LE(pcm.length-4)).toBeGreaterThan(0);
 });
 it('uses the same bus in AutoDJ-to-schedule direction',()=>{
  const bus=new RadioStationDualDeck({overlapMs:1500});
  expect(bus.begin({from:{id:'auto',mode:'AUTO_DJ'},to:{id:'grid',mode:'SCHEDULED'},
   sourceReady:true,targetReady:true,authority:true}).ok).toBe(true);
  const result=bus.push(frame(1500,9000),frame(1500,6500));
  expect(result.status).toBe('COMPLETED');
  expect(result.continuation.consumedFrames).toBe(72000);
 });
 it('never blends unauthorized, live or missing source',()=>{
  const bus=new RadioStationDualDeck();
  for(const patch of [{authority:false},{publicLive:true},{targetReady:false}]){
   const result=bus.begin({from:{id:'a',mode:'SCHEDULED'},
    to:{id:'b',mode:'AUTO_DJ'},authority:true,sourceReady:true,targetReady:true,...patch});
   expect(result.ok).toBe(false);
   expect(bus.active).toBe(false);
  }
 });
});
