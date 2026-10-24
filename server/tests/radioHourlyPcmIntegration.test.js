import {describe,it,expect} from 'vitest';
import {planHourlyTrackHandover as handover} from '../src/lib/radioHourlyHandover.js';
import {scheduledHourlyAdmission as admission} from '../src/lib/radioScheduledHourlyAdmission.js';
import {reserveScheduledHourlySuccessor as reserve} from '../src/lib/radioScheduledHourlyCursor.js';
import {resolveHourlyScheduledResume as resume} from '../src/lib/radioScheduledHourlyResume.js';
import {boundHourlyPcmChunk as bound} from '../src/lib/radioHourlyPcmBounds.js';
import {fadePcmChunk} from '../src/lib/radioPcmSourceFades.js';
const boundary=Date.parse('2026-10-24T12:00:00Z');
const slot={id:'approved-1',playlistId:'playlist-1',endAt:new Date(boundary+180000).toISOString()};
const items=[{asset:{id:'long',durationMs:180000}},
 {asset:{id:'successor',durationMs:65000}},{asset:{id:'final',durationMs:70000}}];
const settings={enabled:true,source:'SCHEDULED',atMs:boundary,boundaryMs:boundary,
 remainingMs:150000,thresholdSeconds:60,maxDelaySeconds:60,
 mode:'BALANCED',hasSignal:true};
describe('hourly scheduled PCM end-to-end policy (pure simulation)',()=>{
 it('preempts long scheduled music even when musical crossfade is present',()=>{
  // Crossfade is not a planner veto: LIVE and scheduled authority are handled separately.
  const planned=handover(settings);
  expect(planned.action).toBe('FADE_AND_ADVANCE');
  const allowed=admission({enabled:true,slot,nowMs:boundary,signalDurationMs:14000,
    fadeMs:1500,trackRemainingMs:150000,trackCategory:'MUSIC'});
  expect(allowed.allowed).toBe(true);
  const r=reserve({slot,items,interruptedIndex:0,nowMs:boundary,announcementMs:14000});
  expect(r.ok).toBe(true);
  expect(resume(r,{slot,items,nowMs:boundary+14000}))
   .toMatchObject({ok:true,assetId:'successor',seekMs:0,index:1});
  expect(resume(r,{slot,items,nowMs:boundary+79000}))
   .toMatchObject({ok:true,assetId:'final',seekMs:0,index:2});
 });
 it('fades 1.5 seconds and discards all excess decoder PCM',()=>{
  const frames=1500*48,cut=frames*4,start=0,packet=Buffer.alloc(cut,0);
  for(let i=0;i<packet.length;i+=2)packet.writeInt16LE(12000,i);
  const gated=bound({chunkBytes:packet.length+19200,emittedBytes:0,
    fadeAtBytes:start,cutAtBytes:cut});
  expect(gated).toMatchObject({takeBytes:cut,dropBytes:19200,complete:true});
  const result=fadePcmChunk(packet,{positionBytes:0,totalBytes:cut,fadeMs:1500,
    fadeIn:false,fadeOut:true});
  expect(Math.abs(result.readInt16LE(0))).toBeGreaterThan(10000);
  expect(Math.abs(result.readInt16LE(result.length-4))).toBeLessThan(2);
 });
 it('never overrides LIVE, a different approved slot or the programme end',()=>{
  expect(handover({...settings,live:true}).action).toBe('NONE');
  expect(admission({enabled:true,slot,nowMs:boundary+176000,
    signalDurationMs:14000,fadeMs:1500,trackRemainingMs:150000}).allowed).toBe(false);
  const r=reserve({slot,items,interruptedIndex:0,nowMs:boundary,announcementMs:14000});
  expect(resume(r,{slot:{...slot,id:'replacement'},items,nowMs:boundary+14000}).ok).toBe(false);
  expect(resume(r,{slot,items,nowMs:boundary+180000}).ok).toBe(false);
 });
 it('lets a short song finish, and skips if no safe remaining window',()=>{
  expect(handover({...settings,remainingMs:59000}).action).toBe('FINISH_THEN_ANNOUNCE');
  expect(admission({enabled:true,slot,nowMs:boundary,signalDurationMs:14000,
    fadeMs:1500,trackRemainingMs:59000,nextSlotStartMs:boundary+10000}).allowed).toBe(false);
 });
});
