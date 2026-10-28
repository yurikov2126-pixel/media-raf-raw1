import {describe,it,expect} from 'vitest';
import {planRadioEmergencyResume as plan} from '../src/lib/radioEmergencyResumePlan.js';
const start=Date.parse('2026-10-29T10:00:00Z');
const slot={id:'slot1',playlistId:'p1',startAt:new Date(start).toISOString(),
 endAt:new Date(start+60000).toISOString(),playlist:{name:'Программа',items:[{asset:{id:'track1',name:'Трек',durationMs:60000}}]}};
describe('read-only emergency resume planning',()=>{
 it('rechecks active scheduled slot at current station time',()=>{
  expect(plan({source:'SCHEDULE',nowMs:start+3000,slots:[slot]})).toMatchObject({
   ready:true,action:'RECHECK_SCHEDULE_AUTHORITY',slotId:'slot1',trackId:'track1',offsetMs:3000,simulationOnly:true});
 });
 it('never restores expired scheduled program',()=>{
  expect(plan({source:'SCHEDULE',nowMs:start+70000,slots:[slot]}).ready).toBe(false);
 });
 it('redirects AutoDJ to current scheduled slot when slot is active',()=>{
  expect(plan({source:'AUTO_DJ',nowMs:start+3000,slots:[slot]}).action).toBe('RECHECK_SCHEDULE_AUTHORITY');
 });
 it('proposes reselecting AutoDJ after scheduled program ended',()=>{
  expect(plan({source:'AUTO_DJ',nowMs:start+70000,slots:[slot]}).action).toBe('RESELECT_AUTODJ_FROM_LIBRARY');
 });
 it('requires verified live connection and authority',()=>{
  expect(plan({source:'LIVE',nowMs:start,liveConnected:true,liveAuthorized:false}).ready).toBe(false);
  expect(plan({source:'LIVE',nowMs:start,liveConnected:true,liveAuthorized:true}).action).toBe('RECHECK_LIVE_AUTHORITY');
 });
 it('only proposes playlist recovery while playlist remains active',()=>{
  expect(plan({source:'MANUAL_PLAYLIST',nowMs:start+70000,playlistActive:true}).action).toBe('REVALIDATE_PLAYLIST_BEFORE_RESUME');
  expect(plan({source:'AUTO_PLAYLIST',nowMs:start+70000,playlistActive:false}).ready).toBe(false);
 });
 it('rejects unavailable clock or invalid slot',()=>{
  expect(plan({source:'SCHEDULE',nowMs:NaN,slots:[slot]}).ready).toBe(false);
  expect(plan({source:'SCHEDULE',nowMs:start,slots:[{...slot,playlist:{...slot.playlist,items:[{asset:{...slot.playlist.items[0].asset,durationMs:0}}]}}]}).ready).toBe(false);
 });
});