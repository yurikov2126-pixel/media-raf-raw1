import {describe,it,expect} from 'vitest';
import {createMchsLabFixtureStore} from '../src/lib/mchsLabFixtureStore.js';
function wav(frames=2400){
 const b=Buffer.alloc(44+frames*2);
 b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);
 b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);
 b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);
 b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);
 b.write('data',36);b.writeUInt32LE(frames*2,40);return b;
}
describe('isolated MCHS training file stage',()=>{
 it('stores and clears only two expected kinds',()=>{
  const s=createMchsLabFixtureStore();
  expect(s.put('music',wav()).stored).toBe('MEMORY_ONLY');
  expect(s.put('trainingVoice',wav()).connectedToStation).toBe(false);
  expect(s.status().music.seconds).toBeCloseTo(.1);
  s.clear();expect(s.status().music).toBeNull();
 });
 it('rejects invalid headers, unknown kind and oversized files',()=>{
  const s=createMchsLabFixtureStore();
  expect(()=>s.put('alert',wav())).toThrow();
  const invalid=wav();invalid.writeUInt32LE(44100,24);
  expect(()=>s.put('music',invalid)).toThrow();
  expect(()=>s.put('music',Buffer.alloc(480046))).toThrow();
 });
});