import {describe,it,expect} from 'vitest';
import {makeEmergencyTestWav} from '../src/lib/mchsIsolatedAudioPreview.js';

describe('isolated MCHS browser WAV preview',()=>{
 it('produces a valid short mono PCM WAV',()=>{
  const data=makeEmergencyTestWav();
  expect(data.toString('ascii',0,4)).toBe('RIFF');
  expect(data.toString('ascii',8,12)).toBe('WAVE');
  expect(data.toString('ascii',36,40)).toBe('data');
  expect(data.readUInt32LE(24)).toBe(48000);
  expect(data.readUInt16LE(22)).toBe(1);
  expect(data.readUInt16LE(34)).toBe(16);
  expect(data.readUInt32LE(40)).toBe(48000*2*1.6);
  expect(data.length).toBe(data.readUInt32LE(40)+44);
 });
 it('has an audible bounded amplitude and starts silent',()=>{
  const data=makeEmergencyTestWav();
  expect(data.readInt16LE(44)).toBe(0);
  let max=0;for(let i=44;i<data.length;i+=2)max=Math.max(max,Math.abs(data.readInt16LE(i)));
  expect(max).toBeGreaterThan(100);
  expect(max).toBeLessThan(7000);
 });
 it('rejects invalid sample and duration parameters',()=>{
  expect(()=>makeEmergencyTestWav({durationMs:10000})).toThrow(RangeError);
  expect(()=>makeEmergencyTestWav({sampleRate:0})).toThrow(RangeError);
 });
});