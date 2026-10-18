import {describe,it,expect} from 'vitest';
import {RadioIsolatedMusicSample} from '../src/lib/radioIsolatedMusicSample.js';
import {RadioIsolatedMixOutput} from '../src/lib/radioIsolatedMixOutput.js';
const pcm=v=>{const b=Buffer.alloc(3840);for(let i=0;i<b.length;i+=2)b.writeInt16LE(v,i);return b;};
describe('isolated real music sample',()=>{
 it('loops bounded PCM on exact 20ms frame boundaries',()=>{
  const sample=new RadioIsolatedMusicSample({pcm:Buffer.concat([pcm(4000),pcm(2000)])});
  expect(sample.next().readInt16LE(0)).toBe(4000);
  expect(sample.next().readInt16LE(0)).toBe(2000);
  expect(sample.next().readInt16LE(0)).toBe(4000);
  sample.reset();
  expect(sample.snapshot().frames).toBe(0);
 });
 it('rejects oversized, incomplete or missing PCM',()=>{
  expect(()=>new RadioIsolatedMusicSample({pcm:Buffer.alloc(10)})).toThrow(TypeError);
  expect(()=>new RadioIsolatedMusicSample({pcm:Buffer.alloc(3840*2),maxBytes:3840})).toThrow(TypeError);
  expect(()=>RadioIsolatedMusicSample.fromFile('')).toThrow(TypeError);
 });
 it('ducks real music beneath a live PCM frame and clears sessions',()=>{
  const sample=new RadioIsolatedMusicSample({pcm:pcm(8000)});
  const out=new RadioIsolatedMixOutput({musicSample:sample});
  expect(out.accept(pcm(1000),1000).ok).toBe(true);
  const payload=out.read({after:null,nowMs:1000});
  const mixed=Buffer.from(payload.frames[0].pcmBase64,'base64');
  expect(mixed.readInt16LE(0)).toBe(3000);
  expect(out.snapshot().mode).toBe('ISOLATED_REAL_MUSIC_SAMPLE');
  out.reset();
  expect(out.read({after:null,nowMs:1000}).ok).toBe(false);
 });
});