import {describe,it,expect} from 'vitest';
import {evaluateRadioStagingReadiness} from '../src/lib/radioStagingReadiness.js';
const good={worker:{reachable:true,pcmFresh:true,connectedToEncoder:false},
 studio:{gatewayRunning:true,presenterConnected:true},hardwareDisconnected:true};
describe('radio staging safety gate',()=>{
 it('permits isolated rehearsal, never a public broadcast',()=>{
  expect(evaluateRadioStagingReadiness(good)).toMatchObject({
   readyForIsolatedTest:true,readyForPublicBroadcast:false,failed:[]});
 });
 it('fails closed for unknown Worker, stale audio and physical output',()=>{
  expect(evaluateRadioStagingReadiness().readyForIsolatedTest).toBe(false);
  for(const change of [{worker:{...good.worker,pcmFresh:false}},
   {worker:{...good.worker,connectedToEncoder:true}},
   {studio:{...good.studio,gatewayRunning:false}},
   {hardwareDisconnected:false}]){
   const result=evaluateRadioStagingReadiness({...good,...change});
   expect(result.readyForIsolatedTest).toBe(false);
   expect(result.failed.length).toBeGreaterThan(0);
  }
 });
});