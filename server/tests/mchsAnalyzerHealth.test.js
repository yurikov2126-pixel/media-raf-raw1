import {describe,it,expect,beforeEach} from 'vitest';
import {noteMchsAnalyzerAttempt,noteMchsAnalyzerSuccess,noteMchsAnalyzerFailure,mchsAnalyzerPublicStatus,resetMchsAnalyzerHealthForTests} from '../src/lib/mchsAnalyzerHealth.js';
beforeEach(()=>resetMchsAnalyzerHealthForTests());
describe('MCHS analyzer heartbeat',()=>{
 it('never calls enabled configuration a confirmed live worker',()=>{
  expect(mchsAnalyzerPublicStatus(true).healthy).toBe(false);
 });
 it('reports recent successful polling as healthy, even with empty queue',()=>{
  const now=new Date('2026-10-28T10:00:00Z');
  noteMchsAnalyzerAttempt(now);noteMchsAnalyzerSuccess(0,now);
  expect(mchsAnalyzerPublicStatus(true,now.getTime()+15000).healthy).toBe(true);
 });
 it('reports stale success as unhealthy',()=>{
  const now=new Date('2026-10-28T10:00:00Z');
  noteMchsAnalyzerSuccess(1,now);
  expect(mchsAnalyzerPublicStatus(true,now.getTime()+120000).healthy).toBe(false);
 });
 it('reports failures without enabling playback',()=>{
  const now=new Date('2026-10-28T10:00:00Z');
  noteMchsAnalyzerSuccess(1,now);noteMchsAnalyzerFailure(new Error('database disconnected'),now);
  const result=mchsAnalyzerPublicStatus(true,now.getTime());
  expect(result.healthy).toBe(false);
  expect(result.runtime.lastError).toContain('database disconnected');
  expect(result.playbackEnabled).toBe(false);
 });
});
