import {describe,it,expect} from 'vitest';
import {mixRadioPcmFrames,IsolatedLiveMixer} from '../src/lib/radioIsolatedLiveMixer.js';
import {RadioOfflineMixHarness} from '../src/lib/radioOfflineMixHarness.js';
const pcm=v=>{const b=Buffer.alloc(3840);for(let i=0;i<b.length;i+=2)b.writeInt16LE(v,i);return b;};
const voice=(n=0,v=12000)=>({pcm:pcm(v),frameIndex:n*960});
describe('Audio Engine 5.0 isolated PCM mixer',()=>{
 it('preserves music PCM samples in music-only mode',()=>{
  const music=pcm(1234),r=mixRadioPcmFrames({music});
  expect(r.pcm.equals(music)).toBe(true);
  expect(r.connectedToEncoder).toBe(false);
 });
 it('mixes voice while ducking music and saturates instead of wrapping',()=>{
  const r=mixRadioPcmFrames({music:pcm(12000),voice:pcm(12000),ducking:.25});
  expect(r.pcm.readInt16LE(0)).toBe(15000);
  const clipped=mixRadioPcmFrames({music:pcm(30000),voice:pcm(30000),ducking:1});
  expect(clipped.pcm.readInt16LE(0)).toBe(32767);
 });
 it('requires ordered voice frames and fails closed on underrun',()=>{
  const m=new IsolatedLiveMixer({maxFrames:2});
  expect(m.pushVoice(voice(0)).ok).toBe(true);
  expect(m.mix({music:pcm(0),voiceAllowed:true}).ok).toBe(true);
  expect(m.mix({music:pcm(0),voiceAllowed:true}).reason).toBe('VOICE_UNDERRUN');
  expect(m.mix({music:pcm(0)}).ok).toBe(false);
  m.reset();expect(m.pushVoice(voice(0)).ok).toBe(true);
  expect(m.pushVoice(voice(2)).reason).toBe('VOICE_SEQUENCE_GAP');
 });
 it('refuses oversized voice queue',()=>{
  const m=new IsolatedLiveMixer({maxFrames:1});
  m.pushVoice(voice(0));
  expect(m.pushVoice(voice(1)).reason).toBe('VOICE_BUFFER_OVERFLOW');
 });
 it('never admits voice during scheduled show or unknown authority',()=>{
  for(const authority of [null,{scheduleKnown:false},{scheduleKnown:true,scheduledActive:true,leaseValid:true,pcmReady:true}]){
   const h=new RadioOfflineMixHarness();
   h.feedVoice(voice());
   const r=h.render({music:pcm(8000),authority,voiceConsent:true});
   expect(r.selectedSource).toBe('MUSIC_ONLY');
   expect(r.pcm.readInt16LE(0)).toBe(8000);
   expect(r.changeApplied).toBe(false);
  }
 });
 it('allows simulated voice only with explicit consent, lease and PCM readiness',()=>{
  const h=new RadioOfflineMixHarness();
  h.feedVoice(voice(0,10000));
  const authority={scheduleKnown:true,scheduledActive:false,leaseValid:true,pcmReady:true};
  const r=h.render({music:pcm(8000),authority,voiceConsent:true});
  expect(r.selectedSource).toBe('ISOLATED_MIX');
  expect(r.pcm.readInt16LE(0)).toBe(12000);
  expect(h.snapshot().connectedToEncoder).toBe(false);
 });
 it('rejects invalid gain and malformed PCM',()=>{
  expect(()=>mixRadioPcmFrames({music:pcm(1),voiceGain:1.2})).toThrow(RangeError);
  expect(()=>mixRadioPcmFrames({music:Buffer.alloc(2)})).toThrow(TypeError);
 });
});
