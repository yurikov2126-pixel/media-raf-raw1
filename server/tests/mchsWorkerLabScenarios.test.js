import {describe,it,expect} from 'vitest';
import {makeWorkerLabScenarioWav,WORKER_LAB_SCENARIOS} from '../src/lib/mchsWorkerLabScenarios.js';

function energy(wav,a,b){
 const rate=wav.readUInt32LE(24);let total=0,count=0;
 for(let i=Math.floor(a*rate);i<Math.floor(b*rate);i++){
  const n=wav.readInt16LE(44+i*2)/32768;total+=n*n;count++;
 }
 return total/count;
}
describe('Worker isolated emergency audio scenarios',()=>{
 it.each(WORKER_LAB_SCENARIOS)('%s generates bounded PCM RIFF WAV',name=>{
  const wav=makeWorkerLabScenarioWav(name);
  expect(wav.toString('ascii',0,4)).toBe('RIFF');
  expect(wav.toString('ascii',8,12)).toBe('WAVE');
  expect(wav.length).toBeLessThan(750000);
  expect(energy(wav,0.5,1.5)).toBeGreaterThan(0.001);
  expect(energy(wav,2.5,3.5)).toBeGreaterThan(0.001);
  expect(energy(wav,2.5,3.5)).toBeLessThan(0.03);
 });
 it('resumes after first cue',()=>expect(energy(makeWorkerLabScenarioWav('resume'),4.5,5.5)).toBeGreaterThan(0.001));
 it('hard stop is genuinely silent after cue',()=>expect(energy(makeWorkerLabScenarioWav('stop'),4.5,5.5)).toBe(0));
 it('repeat contains second cue and resumes',()=>{
  const wav=makeWorkerLabScenarioWav('repeat');
  expect(energy(wav,6.25,6.75)).toBeGreaterThan(0.001);
  expect(energy(wav,7.5,8.5)).toBeGreaterThan(0.001);
 });
 it('rejects unknown scenarios',()=>expect(()=>makeWorkerLabScenarioWav('live')).toThrow(RangeError));
});
