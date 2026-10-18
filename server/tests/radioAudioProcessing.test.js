import {describe,expect,it} from 'vitest';
import {DEFAULT_AUDIO_PROCESSING,validateAudioProcessing,audioProcessingFilter} from '../src/lib/radioAudioProcessing.js';
describe('radio audio processing',()=>{
  it('defaults to bypass, preserving existing live stream',()=>{
    expect(DEFAULT_AUDIO_PROCESSING.enabled).toBe(false);
    expect(audioProcessingFilter(DEFAULT_AUDIO_PROCESSING,120)).toBeNull();
  });
  it('rejects invalid, nonnumeric and out-of-range controls',()=>{
    expect(()=>validateAudioProcessing({...DEFAULT_AUDIO_PROCESSING,loudnessTarget:100})).toThrow();
    expect(()=>validateAudioProcessing({...DEFAULT_AUDIO_PROCESSING,truePeak:'-2'})).toThrow();
    expect(()=>validateAudioProcessing({...DEFAULT_AUDIO_PROCESSING,fadeMs:10000})).toThrow();
  });
  it('generates safe one-pass loudnorm and bounded fade filter',()=>{
    const result=audioProcessingFilter({...DEFAULT_AUDIO_PROCESSING,enabled:true,fadeMs:500},10);
    expect(result).toContain('loudnorm=I=-16:TP=-2:LRA=11:linear=false');
    expect(result).toContain('afade=t=in:st=0:d=0.5');
    expect(result).toContain('afade=t=out:st=9.500:d=0.5');
  });
  it('does not fade out short clips longer than the remaining budget',()=>{
    const result=audioProcessingFilter({...DEFAULT_AUDIO_PROCESSING,enabled:true,fadeMs:1000},1);
    expect(result).not.toContain('afade=t=out');
  });
});