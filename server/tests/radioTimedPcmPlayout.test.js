import {describe,it,expect} from 'vitest';
import {RadioTimedPcmPlayout} from '../src/lib/radioTimedPcmPlayout.js';
const frame=n=>({pcm:Buffer.alloc(3840,n%255),frameIndex:n*960});
describe('isolated timed PCM playout simulation',()=>{
  it('prebuffers and emits one frame on each exact 20ms deadline',()=>{
    const p=new RadioTimedPcmPlayout({prebufferFrames:2});
    p.push(frame(0),1000);p.push(frame(1),1005);p.push(frame(2),1010);
    expect(p.tick(1010).output.frameIndex).toBe(0);
    expect(p.tick(1015).output).toBeNull();
    expect(p.tick(1030).output.frameIndex).toBe(960);
    expect(p.tick(1050).output.frameIndex).toBe(1920);
    expect(p.snapshot(1050).connectedToEncoder).toBe(false);
  });
  it('does not emit until minimum prebuffer is available',()=>{
    const p=new RadioTimedPcmPlayout({prebufferFrames:3});
    p.push(frame(0),1000);
    expect(p.tick(1000).state).toBe('BUFFERING');
  });
  it('fails on missing PCM rather than replaying old samples',()=>{
    const p=new RadioTimedPcmPlayout({prebufferFrames:1});
    p.push(frame(0),1000);
    expect(p.tick(1000).output.frameIndex).toBe(0);
    expect(p.tick(1020).reason).toBe('BUFFER_UNDERRUN');
    expect(p.tick(1040).output).toBeNull();
  });
  it('fails closed on late scheduler tick',()=>{
    const p=new RadioTimedPcmPlayout({prebufferFrames:1});
    p.push(frame(0),1000);p.push(frame(1),1000);
    p.tick(1000);
    expect(p.tick(1040).reason).toBe('TIMER_OVERRUN');
  });
  it('detects packet gaps, duplicates, and buffer overflow',()=>{
    const p=new RadioTimedPcmPlayout({prebufferFrames:1,maxFrames:2});
    p.push(frame(0),1000);
    expect(p.push(frame(2),1010).reason).toBe('SEQUENCE_GAP');
    expect(p.push(frame(1),1020).reason).toBe('RESET_REQUIRED');
    p.reset();p.push(frame(0),1030);p.push(frame(1),1040);
    expect(p.push(frame(2),1050).reason).toBe('BUFFER_OVERFLOW');
  });
  it('rejects a stalled producer',()=>{
    const p=new RadioTimedPcmPlayout({prebufferFrames:1,staleMs:100});
    p.push(frame(0),1000);
    expect(p.tick(1101).reason).toBe('STALE_INPUT');
  });
});