import {describe,it,expect} from 'vitest';
import {preflightTimeSignal} from '../src/lib/radioTimeSignalPreflight.js';
describe('hourly audio preflight fail-closed',()=>{
 it('rejects assets in the wrong category before launching a decoder',async()=>{
  expect(await preflightTimeSignal({asset:{category:'MUSIC',durationMs:5000,storageKey:'a.mp3'},assetsRoot:'/tmp'}))
   .toEqual({ok:false,reason:'INVALID_ASSET'});
 });
 it('does not accept absent files',async()=>{
  const res=await preflightTimeSignal({asset:{category:'TIME_SIGNAL',durationMs:5000,storageKey:'not-existing-hour-signal.mp3'},assetsRoot:'/tmp'});
  expect(res.ok).toBe(false);
  expect(res.reason).toBe('FILE_MISSING');
 });
});
