import {describe,expect,it} from 'vitest';
import {sanitizeAudioSettings,decoderAudioFilters} from '../src/lib/radioAudioProcessing.js';

describe('server audio processing',()=>{
  it('defaults to bypass with no changes to the audio pipeline',()=>{
    expect(decoderAudioFilters(sanitizeAudioSettings(),180)).toEqual([]);
  });
  it('limits fade values to safe presets',()=>{
    expect(sanitizeAudioSettings({enabled:true,fadeMs:10000}).fadeMs).toBe(0);
  });
  it('generates selectable loudness normalization and limiter filters',()=>{
    const args=decoderAudioFilters({enabled:true,normalization:true,limiter:true,fadeMs:250},60);
    expect(args[0]).toBe('-af');
    expect(args[1]).toContain('loudnorm=I=-16');
    expect(args[1]).toContain('alimiter=limit=0.90');
    expect(args[1]).toContain('afade=t=out:st=59.750:d=0.25');
  });
  it('does not trim very short source durations',()=>{
    const args=decoderAudioFilters({enabled:true,normalization:false,limiter:false,fadeMs:500},0.3);
    expect(args).toEqual([]);
  });
});
