import { describe, it, expect } from 'vitest';
import { planMchsAudioTransition as plan } from '../src/lib/mchsAudioTransitionPlan.js';
const base={eventType:'UAV_DANGER',audioAsset:{category:'ALARM',mimeType:'audio/mpeg',durationMs:25000},source:'AUTO_DJ',sourceId:'track-1',ageMs:20000};
describe('MCHS transition plan remains non-executable',()=>{
 it('rejects direct Android observation without independent verification',()=>{
  const r=plan(base);
  expect(r.permitted).toBe(false);
  expect(r.reasons).toContain('OFFICIAL_CONFIRMATION_REQUIRED');
  expect(r.reasons).toContain('PUBLIC_STREAM_NOT_ISOLATED');
 });
 it('cannot dispatch even when inputs claim all gates pass',()=>{
  const r=plan({...base,officialVerified:true,physicalOutputIsolated:true,publicStreamIsolated:true});
  expect(r.executable).toBe(false);
  expect(r.output).toBe('NONE');
  expect(r.status).toBe('DESIGN_REVIEW_REQUIRED');
 });
 it('blocks live presenter interruptions',()=>{
  const r=plan({...base,source:'LIVE'});
  expect(r.reasons).toContain('LIVE_SOURCE_PROTECTED');
 });
 it('rejects non-ALARM assets and stale events',()=>{
  const r=plan({...base,audioAsset:{...base.audioAsset,category:'MUSIC'},ageMs:300000});
  expect(r.reasons).toEqual(expect.arrayContaining(['INVALID_ALARM_ASSET','STALE_EVENT']));
 });
});
