import {describe,it,expect} from 'vitest';
import {makeMchsLabSessionChunk} from '../src/lib/mchsWorkerLabSessionAudio.js';
function rms(wav){let sum=0;for(let i=44;i<wav.length;i+=2){const v=wav.readInt16LE(i)/32768;sum+=v*v;}return Math.sqrt(sum/((wav.length-44)/2));}
describe('MCHS Worker isolated server session audio',()=>{
 it('produces bounded RIFF/WAVE mono PCM16 chunks',()=>{
  const wav=makeMchsLabSessionChunk('PROGRAM');
  expect(wav.length).toBe(24044);
  expect(wav.toString('ascii',0,4)).toBe('RIFF');
  expect(wav.toString('ascii',8,12)).toBe('WAVE');
  expect(wav.readUInt32LE(24)).toBe(24000);
 });
 it('is silent in idle and audible in programme and alert',()=>{
  expect(rms(makeMchsLabSessionChunk('IDLE'))).toBe(0);
  expect(rms(makeMchsLabSessionChunk('PROGRAM'))).toBeGreaterThan(0.01);
  expect(rms(makeMchsLabSessionChunk('ALERT'))).toBeGreaterThan(0.01);
 });
 it('rejects unknown output modes',()=>expect(()=>makeMchsLabSessionChunk('LIVE')).toThrow(RangeError));
});