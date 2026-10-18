import {describe,expect,it} from 'vitest';
import {validateCue,cueAssets,cueCursor} from '../src/lib/radioAudioCue.js';
const audio=[{id:'a',name:'A',durationMs:60000},{id:'b',name:'B',durationMs:90000}];
describe('Auto-DJ cue points',()=>{
  it('requires valid interval with at least one second',()=>{
    expect(()=>validateCue({inMs:5000,outMs:5000},60000)).toThrow();
    expect(()=>validateCue({inMs:-10,outMs:55000},60000)).toThrow();
    expect(()=>validateCue({inMs:0,outMs:61000},60000)).toThrow();
    expect(validateCue({inMs:5000,outMs:55000},60000)).toEqual({inMs:5000,outMs:55000});
  });
  it('resolves trim and ffmpeg seek in deterministic station time',()=>{
    const tracks=cueAssets(audio,{a:{inMs:5000,outMs:55000}});
    expect(tracks[0].playDurationMs).toBe(50000);
    expect(cueCursor(tracks,0)).toMatchObject({id:'a',seekMs:5000,offsetMs:0});
    expect(cueCursor(tracks,25000)).toMatchObject({id:'a',seekMs:30000});
    expect(cueCursor(tracks,50000)).toMatchObject({id:'b',seekMs:0});
    expect(cueCursor(tracks,140000)).toMatchObject({id:'a',seekMs:5000});
  });
  it('ignores stale cue metadata beyond actual file duration',()=>{
    const tracks=cueAssets(audio,{a:{inMs:55000,outMs:110000}});
    expect(tracks[0].playDurationMs).toBe(60000);
  });
});