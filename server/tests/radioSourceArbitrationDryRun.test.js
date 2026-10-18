import {describe,it,expect} from 'vitest';
import {planRadioSource, RADIO_SOURCE, RADIO_DECISION} from '../src/lib/radioSourceArbitrationDryRun.js';

const ready = {
  nowMs:10000, pcmLastAt:9950, pcmBufferedMs:200,
  presenterAuthorized:true,presenterConnected:true,gatewayRunning:true,
};

describe('radio source arbitration (dry-run only)',()=>{
  it('always prioritizes an active ready scheduled broadcast',()=>{
    expect(planRadioSource({...ready,scheduledActive:true,scheduledSourceReady:true}))
      .toEqual({recommendedSource:RADIO_SOURCE.SCHEDULE,reason:RADIO_DECISION.SCHEDULE_PRIORITY,
        presenterEligible:false,changeApplied:false});
  });
  it('does not allow presenter to override a scheduled slot if its source is unhealthy',()=>{
    const r=planRadioSource({...ready,scheduledActive:true,scheduledSourceReady:false});
    expect(r.recommendedSource).toBe(RADIO_SOURCE.AUTO_DJ);
    expect(r.presenterEligible).toBe(false);
  });
  it('requires all explicit presenter readiness checks',()=>{
    const result=planRadioSource(ready);
    expect(result.recommendedSource).toBe(RADIO_SOURCE.PRESENTER);
    expect(result.presenterEligible).toBe(true);
    expect(result.changeApplied).toBe(false);
    for(const key of ['presenterAuthorized','presenterConnected','gatewayRunning']){
      expect(planRadioSource({...ready,[key]:false}).recommendedSource).toBe(RADIO_SOURCE.AUTO_DJ);
    }
  });
  it('rejects stale, future-dated, missing and insufficient PCM',()=>{
    expect(planRadioSource({...ready,pcmLastAt:8000}).reason).toBe(RADIO_DECISION.PRESENTER_STALE);
    expect(planRadioSource({...ready,pcmLastAt:10001}).recommendedSource).toBe(RADIO_SOURCE.AUTO_DJ);
    expect(planRadioSource({...ready,pcmLastAt:null}).recommendedSource).toBe(RADIO_SOURCE.AUTO_DJ);
    expect(planRadioSource({...ready,pcmBufferedMs:20}).reason).toBe(RADIO_DECISION.PRESENTER_BUFFERING);
  });
  it('never changes station playout, including a ready presenter',()=>{
    for(const candidate of [ready,{...ready,scheduledActive:true,scheduledSourceReady:true},{}]){
      expect(planRadioSource(candidate).changeApplied).toBe(false);
    }
  });
  it('rejects invalid clock configuration',()=>{
    expect(()=>planRadioSource({nowMs:NaN})).toThrow(TypeError);
    expect(()=>planRadioSource({minBufferMs:-1})).toThrow(TypeError);
  });
});
