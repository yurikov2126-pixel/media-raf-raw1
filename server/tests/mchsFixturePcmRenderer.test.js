import {describe,it,expect} from 'vitest';
import {createMchsLabFixtureStore} from '../src/lib/mchsLabFixtureStore.js';
import {createMchsFixturePcmRenderer} from '../src/lib/mchsFixturePcmRenderer.js';
function fixture(value,frames=4800){
 const b=Buffer.alloc(44+frames*2);
 b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);
 b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);
 b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);
 b.write('data',36);b.writeUInt32LE(frames*2,40);
 for(let i=0;i<frames;i++)b.writeInt16LE(value,44+i*2);
 return b;
}
const state=(phase,revision)=>({phase,revision});
describe('MCHS isolated real fixture PCM renderer',()=>{
 it('is silent when fixtures absent, even during program or alert',()=>{
  const r=createMchsFixturePcmRenderer(createMchsLabFixtureStore());
  expect(r.render(state('PROGRAM',1)).every(b=>b===0)).toBe(true);
  expect(r.render(state('ALERT',2)).every(b=>b===0)).toBe(true);
 });
 it('pauses music during announcement and resumes at exact cursor',()=>{
  const store=createMchsLabFixtureStore();
  store.put('music',fixture(10000));store.put('trainingVoice',fixture(-12000));
  const r=createMchsFixturePcmRenderer(store);
  r.render(state('PROGRAM',1));const before=r.diagnostic().musicPosition;
  const alert=r.render(state('ALERT',2));
  expect(alert.readInt16LE(800)).toBeLessThan(0);
  expect(r.diagnostic().musicPosition).toBe(before);
  r.render(state('ALERT',2));
  expect(r.diagnostic().musicPosition).toBe(before);
  const resumed=r.render(state('PROGRAM',3));
  expect(resumed.readInt16LE(800)).toBeGreaterThan(0);
  expect(r.diagnostic().musicPosition).toBe(before+480);
 });
 it('stops to silence and never loops completed training voice',()=>{
  const store=createMchsLabFixtureStore();
  store.put('music',fixture(10000));store.put('trainingVoice',fixture(-10000,480));
  const r=createMchsFixturePcmRenderer(store);
  r.render(state('ALERT',1));
  expect(r.render(state('ALERT',1)).every(b=>b===0)).toBe(true);
  expect(r.render(state('IDLE',2)).every(b=>b===0)).toBe(true);
  expect(r.diagnostic().musicPosition).toBe(0);
 });
 it('clearing fixtures yields silence without falling back to synthetic tone',()=>{
  const store=createMchsLabFixtureStore();store.put('music',fixture(10000));
  const r=createMchsFixturePcmRenderer(store);
  expect(r.render(state('PROGRAM',1)).readInt16LE(800)).toBeGreaterThan(0);
  store.clear();
  expect(r.render(state('PROGRAM',1)).every(b=>b===0)).toBe(true);
 });
});