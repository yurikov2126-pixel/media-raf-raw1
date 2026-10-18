import {describe,it,expect} from 'vitest';
import {evaluateRadioPresenterReadiness} from '../src/lib/radioPresenterReadiness.js';
const nowMs=10000;
const good={workerStatus:{enabled:true,session:{active:true},
  timedShadow:{enabled:true,state:'READY',fresh:true,pcmLastAt:9950,bufferedMs:140,connectedToEncoder:false}},
  presenterAuthorized:true,presenterConnected:true,gatewayRunning:true,nowMs};
describe('radio presenter readiness diagnostics',()=>{
  it('reports eligibility but never applies audio source changes',()=>{
    const v=evaluateRadioPresenterReadiness(good);
    expect(v.diagnosticReady).toBe(true);
    expect(v.recommendedSource).toBe('PRESENTER');
    expect(v.changeApplied).toBe(false);
    expect(v.liveOutputConnected).toBe(false);
  });
  it('respects schedule priority even with healthy PCM',()=>{
    const v=evaluateRadioPresenterReadiness({...good,scheduledActive:true,scheduledSourceReady:true});
    expect(v.recommendedSource).toBe('SCHEDULE');
    expect(v.diagnosticReady).toBe(false);
    expect(v.blockers).toContain('SCHEDULE_ACTIVE');
  });
  it('rejects missing or disabled telemetry fail-closed',()=>{
    for(const workerStatus of [null,{}, {enabled:true,session:{active:true}}]){
      const v=evaluateRadioPresenterReadiness({...good,workerStatus});
      expect(v.diagnosticReady).toBe(false);
      expect(v.recommendedSource).toBe('AUTO_DJ');
    }
  });
  it('rejects stale, future and low-buffer frames',()=>{
    const base=good.workerStatus;
    const stale=evaluateRadioPresenterReadiness({...good,workerStatus:{...base,timedShadow:{...base.timedShadow,pcmLastAt:7000}}});
    expect(stale.blockers).toContain('PCM_STALE');
    const future=evaluateRadioPresenterReadiness({...good,workerStatus:{...base,timedShadow:{...base.timedShadow,pcmLastAt:10001}}});
    expect(future.diagnosticReady).toBe(false);
    const low=evaluateRadioPresenterReadiness({...good,workerStatus:{...base,timedShadow:{...base.timedShadow,bufferedMs:40}}});
    expect(low.blockers).toContain('PCM_BUFFER_LOW');
    expect(low.diagnosticReady).toBe(false);
  });
  it('never treats an inactive session or failed shadow as ready',()=>{
    const v=evaluateRadioPresenterReadiness({...good,workerStatus:{...good.workerStatus,session:{active:false},timedShadow:{enabled:true,state:'FAILED',fresh:false,bufferedMs:0}}});
    expect(v.blockers).toContain('PCM_SESSION_INACTIVE');
    expect(v.blockers).toContain('SHADOW_NOT_READY');
    expect(v.diagnosticReady).toBe(false);
  });
});
