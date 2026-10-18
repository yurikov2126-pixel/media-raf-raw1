import {describe,it,expect} from 'vitest';
import {RadioPcmStaging} from '../src/lib/radioPcmStaging.js';
const frame=(index=0)=>({pcm:Buffer.alloc(3840),frameIndex:index});
describe('Radio 2.0 PCM bounded staging',()=>{
  it('accounts 20ms frames and dequeues without reusing them',()=>{
    const q=new RadioPcmStaging();
    expect(q.push(frame(0),1000).accepted).toBe(true);
    expect(q.push(frame(960),1020).accepted).toBe(true);
    expect(q.snapshot(1020).bufferedMs).toBe(40);
    expect(q.shift().frameIndex).toBe(0);
    expect(q.shift().frameIndex).toBe(960);
    expect(q.shift()).toBeNull();
    expect(q.snapshot(1020).bufferedMs).toBe(0);
  });
  it('fails closed on duplicate or missing PCM and preserves diagnostics',()=>{
    const q=new RadioPcmStaging();
    q.push(frame(0),1000);
    const bad=q.push(frame(0),1020);
    expect(bad.reason).toBe('PCM_DISCONTINUITY');
    expect(q.snapshot(1020).discontinuities).toBe(1);
    expect(q.snapshot(1020).bufferedMs).toBe(0);
  });
  it('rejects stale stream epochs without carrying old PCM',()=>{
    const q=new RadioPcmStaging({staleAfterMs:500});
    q.push(frame(0),1000);
    expect(q.snapshot(1501).pcmFresh).toBe(false);
    expect(q.push(frame(960),1501).reason).toBe('STALE_PCM_EPOCH');
    expect(q.snapshot(1501).bufferedFrames).toBe(0);
  });
  it('limits staging memory and fails instead of trimming old frames',()=>{
    const q=new RadioPcmStaging({maxFrames:1});
    q.push(frame(0),1000);
    expect(q.push(frame(960),1020).reason).toBe('PCM_OVERFLOW');
    expect(q.snapshot(1020).overflows).toBe(1);
    expect(q.snapshot(1020).bufferedFrames).toBe(0);
  });
  it('rejects malformed frames and impossible settings',()=>{
    const q=new RadioPcmStaging();
    expect(q.push({pcm:Buffer.alloc(3),frameIndex:0},1000).accepted).toBe(false);
    expect(()=>new RadioPcmStaging({maxFrames:0})).toThrow(TypeError);
  });
});
