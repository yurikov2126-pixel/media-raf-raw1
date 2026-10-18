import {describe,it,expect} from 'vitest';
import {RadioVoiceDuckingEnvelope} from '../src/lib/radioVoiceDuckingEnvelope.js';
import {RadioIsolatedMixOutput} from '../src/lib/radioIsolatedMixOutput.js';
const tone=n=>{const b=Buffer.alloc(3840);for(let i=0;i<3840;i+=2)b.writeInt16LE(n,i);return b;};
describe('isolated voice ducking envelope',()=>{
 it('attacks gradually on speech and releases after hold',()=>{
  const e=new RadioVoiceDuckingEnvelope({attackMs:100,releaseMs:200,holdMs:60,duckGain:.2});
  const start=e.step(tone(5000));
  expect(start.musicGain).toBeCloseTo(.84);
  for(let i=0;i<8;i++)e.step(tone(5000));
  expect(e.snapshot().musicGain).toBeLessThan(.35);
  for(let i=0;i<3;i++)e.step(tone(0));
  expect(e.snapshot().musicGain).toBeLessThan(.4);
  for(let i=0;i<15;i++)e.step(tone(0));
  expect(e.snapshot().musicGain).toBeGreaterThan(.8);
 });
 it('ignores silence and rejects malformed PCM',()=>{
  const e=new RadioVoiceDuckingEnvelope();
  for(let i=0;i<20;i++)e.step(tone(0));
  expect(e.snapshot().musicGain).toBe(1);
  expect(()=>e.step(Buffer.alloc(2))).toThrow(TypeError);
  expect(()=>new RadioVoiceDuckingEnvelope({duckGain:2})).toThrow(TypeError);
 });
 it('resets state and maintains bounded output without public routing',()=>{
  const out=new RadioIsolatedMixOutput();
  out.accept(tone(8000),1000);
  expect(out.snapshot().ducking.musicGain).toBeLessThan(1);
  expect(out.snapshot().connectedToEncoder).toBe(false);
  out.reset();
  expect(out.snapshot().ducking.musicGain).toBe(1);
  expect(out.snapshot().bufferedFrames).toBe(0);
 });
});