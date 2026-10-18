import {describe,it,expect} from 'vitest';
import {RadioPrivatePcmPreview} from '../src/lib/radioPrivatePcmPreview.js';
const sample=(v=100)=>{const b=Buffer.alloc(3840);for(let i=0;i<b.length;i+=2)b.writeInt16LE(v,i);return b;};
describe('private PCM WAV snapshot',()=>{
 it('creates valid stereo WAV from authorized test frames',()=>{
  const p=new RadioPrivatePcmPreview();p.accept(sample(100),1000);p.accept(sample(200),1020);
  const wav=p.exportWav(1030);
  expect(wav.toString('ascii',0,4)).toBe('RIFF');
  expect(wav.readUInt32LE(4)).toBe(wav.length-8);
  expect(wav.readUInt16LE(22)).toBe(2);
  expect(wav.readUInt32LE(24)).toBe(48000);
  expect(wav.readInt16LE(44)).toBe(100);
  expect(wav.readInt16LE(44+3840)).toBe(200);
 });
 it('caps audio retention at one second',()=>{
  const p=new RadioPrivatePcmPreview();
  for(let i=0;i<60;i++)p.accept(sample(i),i*20);
  expect(p.snapshot().frames).toBe(50);
  expect(p.exportWav(1200).length).toBe(44+50*3840);
  expect(p.exportWav(1200).readInt16LE(44)).toBe(10);
 });
 it('never exposes stale input or previous session after reset',()=>{
  const p=new RadioPrivatePcmPreview();
  expect(p.exportWav()).toBeNull();
  p.accept(sample(),1000);
  expect(p.exportWav(2501)).toBeNull();
  p.reset();
  expect(p.exportWav(1000)).toBeNull();
 });
 it('rejects malformed samples',()=>{
  const p=new RadioPrivatePcmPreview();
  expect(()=>p.accept(Buffer.alloc(1),1000)).toThrow(TypeError);
  expect(()=>new RadioPrivatePcmPreview({maxFrames:100})).toThrow(TypeError);
 });
});
