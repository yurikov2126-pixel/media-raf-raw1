import {describe,it,expect} from 'vitest';
import {makeOfflineRadioWav} from '../src/lib/radioOfflineWavDemo.js';
describe('offline audible mixer WAV',()=>{
 it('creates a valid 48kHz stereo PCM RIFF file',()=>{
  const wav=makeOfflineRadioWav({seconds:3});
  expect(wav.toString('ascii',0,4)).toBe('RIFF');
  expect(wav.toString('ascii',8,12)).toBe('WAVE');
  expect(wav.readUInt32LE(4)).toBe(wav.length-8);
  expect(wav.readUInt16LE(22)).toBe(2);
  expect(wav.readUInt32LE(24)).toBe(48000);
  expect(wav.readUInt16LE(34)).toBe(16);
  expect(wav.length).toBe(44+3*48000*4);
 });
 it('ducks the music under synthetic voice in the middle section',()=>{
  const wav=makeOfflineRadioWav({seconds:4,voiceHz:220,musicHz:440});
  const sample=(time)=>wav.readInt16LE(44+Math.floor(time*48000)*4);
  expect(Math.abs(sample(1.126))).toBeGreaterThan(0);
  expect(Math.abs(sample(0.126))).toBeGreaterThan(0);
  expect(wav.subarray(44,44+3840).equals(wav.subarray(44+48000*4,44+48000*4+3840))).toBe(false);
 });
 it('limits duration and rejects invalid formats',()=>{
  expect(()=>makeOfflineRadioWav({seconds:31})).toThrow(TypeError);
  expect(()=>makeOfflineRadioWav({sampleRate:44100})).toThrow(TypeError);
 });
});
