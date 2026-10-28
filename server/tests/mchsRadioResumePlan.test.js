import { describe, expect, it } from 'vitest';
import { planRadioResumeAfterExternalAudio as plan } from '../src/lib/mchsRadioResumePlan.js';
describe('safe radio authority resume decisions', () => {
 it('protects an active live source', () => {
  expect(plan({current:{mode:'LIVE'},scheduleKnown:true,scheduleActive:false,liveActive:true}).action).toBe('NO_ACTION');
 });
 it('requeries active scheduled slot and never resumes saved song', () => {
  const r=plan({previous:{trackId:'old'},current:{mode:'SCHEDULED',slotId:'slot2'},scheduleKnown:true,scheduleActive:true});
  expect(r.action).toBe('RESOLVE_SCHEDULED_AT_CURRENT_POSITION');
  expect(r.slotId).toBe('slot2');
  expect(r.resumePreviousTrack).toBe(false);
  expect(r.executable).toBe(false);
 });
 it('does not resume stale AutoDJ song', () => {
  const r=plan({previous:{trackId:'old'},current:{mode:'AUTO_DJ'},scheduleKnown:true,scheduleActive:false});
  expect(r.action).toBe('SELECT_NEXT_AUTODJ_FROM_CURRENT_AUTHORITY');
  expect(r.resumePreviousTrack).toBe(false);
 });
 it('stops if schedule authority is unknown', () => {
  expect(plan({current:{mode:'AUTO_DJ'}}).reason).toBe('SCHEDULE_UNKNOWN');
 });
 it('does not override active scheduled authority with AutoDJ', () => {
  expect(plan({current:{mode:'AUTO_DJ'},scheduleKnown:true,scheduleActive:true}).reason).toBe('SCHEDULE_SOURCE_UNRESOLVED');
 });
 it('keeps manual playlist authority when no schedule active', () => {
  const r=plan({current:{mode:'MANUAL_PLAYLIST',playlistId:'p1'},scheduleKnown:true,scheduleActive:false});
  expect(r.action).toBe('RESOLVE_MANUAL_PLAYLIST_AT_CURRENT_POSITION');
  expect(r.executable).toBe(false);
 });
});
