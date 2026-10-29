import {describe,it,expect} from 'vitest';
import {makeIsolatedHandoverWav} from '../src/lib/mchsIsolatedHandoverWav.js';
describe('offline handover preview',()=>{
 it('produces a valid six second wav',()=>{
  const out=makeIsolatedHandoverWav();
  expect(out.toString('ascii',0,4)).toBe('RIFF');
  expect(out.toString('ascii',8,12)).toBe('WAVE');
  expect(out.readUInt32LE(40)).toBe(24000*6*2);
  expect(out.length).toBe(out.readUInt32LE(40)+44);
 });
 it('keeps cue separate from programme portions',()=>{
  const out=makeIsolatedHandoverWav();
  const sample=t=>out.readInt16LE(44+Math.floor(t*24000)*2);
  expect(Math.abs(sample(0.301))).toBeGreaterThan(0);
  expect(Math.abs(sample(2.501))).toBeGreaterThan(0);
  expect(Math.abs(sample(5.101))).toBeGreaterThan(0);
 });
 it('rejects invalid output format',()=>expect(()=>makeIsolatedHandoverWav({sampleRate:0})).toThrow(RangeError));
});