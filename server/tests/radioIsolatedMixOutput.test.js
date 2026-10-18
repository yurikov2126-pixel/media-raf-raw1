import {describe,it,expect} from 'vitest';
import {RadioIsolatedMixOutput} from '../src/lib/radioIsolatedMixOutput.js';
const frame=value=>{const b=Buffer.alloc(3840);for(let i=0;i<b.length;i+=2)b.writeInt16LE(value,i);return b;};
describe('isolated live PCM mixer output',()=>{
 it('encodes synthetic music plus actual PCM in bounded frames',()=>{
  const out=new RadioIsolatedMixOutput();
  expect(out.accept(frame(1000),1000)).toMatchObject({ok:true,connectedToEncoder:false,changeApplied:false});
  const r=out.read({after:null,nowMs:1000});
  expect(r.ok).toBe(true);
  expect(r.frames).toHaveLength(1);
  const sample=Buffer.from(r.frames[0].pcmBase64,'base64');
  expect(sample.length).toBe(3840);
  expect(sample.readInt16LE(0)).toBe(1000);
  expect(out.snapshot().mixedFrames).toBe(1);
  expect(out.snapshot().changeApplied).toBe(false);
 });
 it('refuses malformed PCM and purges old audio on session reset',()=>{
  const out=new RadioIsolatedMixOutput();
  expect(()=>out.accept(Buffer.alloc(4),1000)).toThrow(TypeError);
  out.accept(frame(500),1000);out.reset();
  expect(out.read({after:null,nowMs:1000}).ok).toBe(false);
 });
 it('never exposes stale frames or permits unlimited retention',()=>{
  const out=new RadioIsolatedMixOutput();
  for(let i=0;i<85;i++)out.accept(frame(i),1000+i*20);
  expect(out.snapshot().bufferedFrames).toBe(75);
  expect(out.read({after:0,nowMs:2700}).reason).toBe('CURSOR_EXPIRED');
  expect(out.read({after:null,nowMs:5000}).reason).toBe('PCM_STALE');
 });
});