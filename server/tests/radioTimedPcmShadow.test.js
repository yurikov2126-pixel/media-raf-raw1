import {describe,it,expect} from 'vitest';
import {RadioTimedPcmPlayout} from '../src/lib/radioTimedPcmPlayout.js';
const pcm=n=>({pcm:Buffer.alloc(3840,n),frameIndex:n*960});
describe('worker shadow PCM session simulation',()=>{
  it('consumes real ordered input frames only through its isolated tick',()=>{
    const shadow=new RadioTimedPcmPlayout();
    for(let n=0;n<6;n++)expect(shadow.push(pcm(n),1000+n*5).ok).toBe(true);
    let emitted=0;
    for(const t of [1025,1045,1065]){
      const result=shadow.tick(t);
      expect(result.ok).toBe(true);
      emitted+=result.output?1:0;
    }
    expect(emitted).toBe(3);
    expect(shadow.snapshot(1065).connectedToEncoder).toBe(false);
  });
  it('resets the shadow across independent Worker sessions',()=>{
    const shadow=new RadioTimedPcmPlayout();
    shadow.push(pcm(0),1000);
    shadow.tick(1000);
    shadow.reset();
    expect(shadow.snapshot(2000).bufferedFrames).toBe(0);
    expect(shadow.push(pcm(0),2000).ok).toBe(true);
  });
  it('fails closed if a timed tick is missed without fabricating audio',()=>{
    const shadow=new RadioTimedPcmPlayout({prebufferFrames:1});
    shadow.push(pcm(0),1000);shadow.push(pcm(1),1000);
    expect(shadow.tick(1000).output.frameIndex).toBe(0);
    const missed=shadow.tick(1040);
    expect(missed.reason).toBe('TIMER_OVERRUN');
    expect(missed.output).toBe(null);
    expect(shadow.snapshot(1040).state).toBe('FAILED');
  });
});
