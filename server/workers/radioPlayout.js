#!/usr/bin/env node
/**
 * Opt-in station playout worker: one persistent MP3 encoder, shared live output.
 * Binds loopback only; authenticated Express API proxy is the sole public entry.
 * This stage mixes scheduled tracks and silence, NOT browser microphone audio.
 */
import 'dotenv/config';
import {createEmergencyDryRun} from '../src/lib/radioEmergencyDryRun.js';
import http from 'node:http';
import {createStationLufsMeter} from '../src/lib/radioStationLufsMeter.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { resolveRadioCursor } from '../src/lib/radioTimeline.js';
import {reserveSourceTransition} from '../src/lib/radioSourceTransitionGuard.js';
import {planSourceHandover} from '../src/lib/radioSourceHandoverClock.js';
import {planReverseHandover} from '../src/lib/radioReverseHandoverPlan.js';
import {reserveReverseTarget,validateReverseTarget} from '../src/lib/radioReverseTargetReservation.js';
import {RadioSourcePcmOverlap} from '../src/lib/radioSourcePcmOverlap.js';
import {RadioStationPcmClock} from '../src/lib/radioStationPcmClock.js';
import {RadioStationDualDeck} from '../src/lib/radioStationDualDeck.js';
import {readPcmFrames} from '../src/lib/radioLivePcmHandover.js';
import {resumeScheduledCursor,continuePcmIterator} from '../src/lib/radioPcmHandoverResume.js';
import {scheduledSuccessor} from '../src/lib/radioScheduledPrewarm.js';
import {scheduledBoundaryFadePolicy} from '../src/lib/radioScheduledBoundaryFade.js';
import { boundScheduledPcm } from '../src/lib/radioSchedulePcmGate.js';
import { isPcmBoundaryAligned, reverseAuthorityFresh } from '../src/lib/radioPcmBoundaryClock.js';
import {createCrossfadeQualityState,observePcmBoundary} from '../src/lib/radioCrossfadeHealth.js';
import { fadePcmChunk,DEFAULT_SOURCE_FADE_MS,PCM_BYTES_PER_MS } from '../src/lib/radioPcmSourceFades.js';
import {boundHourlyPcmChunk,hourlySlotStillAuthorized} from '../src/lib/radioHourlyPcmBounds.js';
import { readAutoDjSettings, selectAutoDjAssets, autoDjCursor } from '../src/lib/radioAutoDj.js';
import { readAudioProcessing, audioProcessingFilter } from '../src/lib/radioAudioProcessing.js';
import { readCues, cueAssets, cueCursor } from '../src/lib/radioAudioCue.js';
import { readRotation, rotationPlan, prioritizeUnplayed, preferArtistGap, fairNextTrack, id3Artist } from '../src/lib/radioRotation.js';
import { readPlayoutHistory, recordPlayoutEvents } from '../src/lib/radioPlayoutHistory.js';
import { playbackAttributions } from '../src/lib/radioPlayoutAttribution.js';
import { preflightNextTracks } from '../src/lib/radioNextTrackPreflight.js';
import { chooseQueuedTrack, selectExhaustionFallback } from '../src/lib/radioEventQueue.js';
import { PcmFrameBuffer } from '../src/lib/radioPcmFrameBuffer.js';
import { LivePcmIntake } from '../src/lib/radioLivePcmIntake.js';
import { LivePcmSessionGate } from '../src/lib/radioLivePcmSession.js';
import { RadioTimedPcmPlayout } from '../src/lib/radioTimedPcmPlayout.js';
import { RadioIsolatedPcmLab } from '../src/lib/radioIsolatedPcmLab.js';
import { RadioPcmLabSoakTelemetry } from '../src/lib/radioPcmLabSoakTelemetry.js';
import { RadioPrivatePcmPreview } from '../src/lib/radioPrivatePcmPreview.js';
import { RadioPrivateLivePcmQueue } from '../src/lib/radioPrivateLivePcmQueue.js';
import { RadioIsolatedMixOutput } from '../src/lib/radioIsolatedMixOutput.js';
import { RadioIsolatedMusicSample } from '../src/lib/radioIsolatedMusicSample.js';
import { RadioPublicLiveGate } from '../src/lib/radioPublicLiveGate.js';
import { RadioWorkerSwitchShadow } from '../src/lib/radioWorkerSwitchShadow.js';
import { PcmGatewayClock } from '../src/lib/radioPcmGatewayClock.js';
import { readJingles } from '../src/lib/radioJingles.js';
import { readTimeSignal } from '../src/lib/radioTimeSignal.js';
import {planHourlySignal,nextHourlyBoundary,hourBoundary} from '../src/lib/radioHourlySignalPlanner.js';
import {planHourlyTrackHandover} from '../src/lib/radioHourlyHandover.js';
import {scheduledHourlyAdmission} from '../src/lib/radioScheduledHourlyAdmission.js';
import {reserveScheduledHourlySuccessor,resolveScheduledHourlySuccessor} from '../src/lib/radioScheduledHourlyCursor.js';
import {resolveHourlyScheduledResume} from '../src/lib/radioScheduledHourlyResume.js';
import {preflightTimeSignal} from '../src/lib/radioTimeSignalPreflight.js';
import { chooseJingleAsset } from '../src/lib/radioJingleRuntime.js';

// Diagnostic-only state machine: never feeds PCM, source authority or amplifier control.
const emergencyDryRun=createEmergencyDryRun();
const port = Number(process.env.RADIO_PLAYOUT_PORT || 4105);
const secret = process.env.RADIO_PLAYOUT_SECRET || '';
if (process.env.RADIO_PLAYOUT_ENABLED !== 'true' || secret.length < 32) {
  throw new Error('Set RADIO_PLAYOUT_ENABLED=true and a shared RADIO_PLAYOUT_SECRET of at least 32 characters');
}
const ffmpeg = process.env.RADIO_FFMPEG_PATH || 'ffmpeg';
const assetsRoot = path.resolve(process.env.RADIO_ASSET_DIR || 'private/radio-audio');
const listeners = new Set();
// Explicit opt-in: disabled until the full PCM transition is validated on-air.
const SCHEDULED_CROSSFADE_ENABLED=process.env.RADIO_SCHEDULED_CROSSFADE_ENABLED==='true';
const scheduledDefaultOverlap=Number(process.env.RADIO_SCHEDULED_DEFAULT_OVERLAP_MS||0);
const SCHEDULED_DEFAULT_OVERLAP_MS=Number.isSafeInteger(scheduledDefaultOverlap)&&scheduledDefaultOverlap>=250&&scheduledDefaultOverlap<=15000?scheduledDefaultOverlap:0;
// OFF by default: strict schedule-entry PCM overlap only, with on-air diagnostics.
const LIVE_SOURCE_CROSSFADE_ENABLED=process.env.RADIO_LIVE_SOURCE_CROSSFADE_ENABLED==='true';
const LIVE_SOURCE_OVERLAP_MS=1500;
// Observe the redesigned station bus without changing a byte of public output.
const STATION_DUAL_DECK_SHADOW_ENABLED=process.env.RADIO_STATION_DUAL_DECK_SHADOW_ENABLED==='true';
const LIVE_SOURCE_OVERLAP_BYTES=LIVE_SOURCE_OVERLAP_MS*PCM_BYTES_PER_MS;
// Non-fatal FFmpeg metadata notices must not overwrite real playout errors.
function isIgnorableMediaNotice(value){
 return /Incorrect BOM value|Error reading frame GEOB|skipped\s*$/i.test(value);
}
const state = { audioProcessing:{enabled:false}, version:'dsp-v1', mode:'STARTING',trackId:null,slotId:null,playout:null,nextTrackId:null,connected:0,startedAt:new Date().toISOString(),lastError:null,frames:0, autoDjEnabled:false };
let decoder = null;
let prewarmed=null;
let prewarming=false;
state.crossfadeQuality=createCrossfadeQualityState();
state.stationDualDeck={enabled:STATION_DUAL_DECK_SHADOW_ENABLED,mode:'SHADOW_ONLY',last:null,observations:0};
let lastPcmTail=null;
state.transitions={prewarmed:0,used:0,missed:0,lastGapMs:null,
 crossfadeAttempted:0,crossfadeCompleted:0,crossfadeFallbacks:0,
 crossfadeFailed:0,lastCrossfade:null,scheduledEnabled:process.env.RADIO_SCHEDULED_CROSSFADE_ENABLED==='true'};
function discardPrewarm(){if(prewarmed){prewarmed.child.kill('SIGTERM');prewarmed=null;}}

let encoder = null;
let stopping = false;
const PCM_STAGING_ENABLED=process.env.RADIO_PCM_STAGING_ENABLED==='true';
state.pcmStaging={enabled:PCM_STAGING_ENABLED,frameBytes:4,droppedTailBytes:0,processedBytes:0};
const failedAutoDjAssets = new Map();
let frozenRotation=null;
// Normal Auto-DJ uses a sequential playback cursor, not a running wall clock.
// This prevents a jingle (and decoder start latency) from consuming the next song.
let musicQueueKey=null, musicQueueNextId=null;
let pendingScheduledHandover=null;
let delayedScheduledSlot=null;
let lastAutoDjTrackId=null;
// Track recently emitted artists at decoder completion; avoids async journal races.
let recentlyAiredArtists=[];
let resumeAutoDjAfterShow=false;
// Track natural EOF of the final scheduled item so wall-clock drift cannot replay it.
let finishedScheduledSlot=null;
// Populated only after a future verified audible hour marker; never by shadow decisions.
let confirmedScheduledHourlyReservation=null;
let lastCompletedScheduledTrack=null;
const finishedScheduledTrackKeys=new Map();
state.lastBoundary=null;
state.sourceHandover={last:null,eligible:0,blocked:0,mixed:0,clockPlanned:0,clockRejected:0,lastClockPlan:null};
let lastDecodedSource=null;
let scheduledEntryOverlap=null;
let reverseReservedTarget=null;
let reverseReservedShift=null;
let reverseMixAuthorityAt=null;
let reverseMixAuthorityReservation=null;
let reverseReserveInFlight=false;
state.reverseTargetReservation={reserved:0,used:0,invalidated:0,last:null,blocked:0,reasons:{}};
function reversePrewarmBlocked(reason,details={}){
  state.reverseTargetReservation.blocked++;
  state.reverseTargetReservation.reasons[reason]=(state.reverseTargetReservation.reasons[reason]||0)+1;
  if(state.reverseTargetReservation.last?.reason!==reason){
    console.info('RADIO_REVERSE_PREWARM',JSON.stringify({status:'BLOCKED',reason,...details,at:new Date().toISOString()}));
  }
  state.reverseTargetReservation.last={status:'BLOCKED',reason,at:new Date().toISOString()};
}
state.liveSourceCrossfade={enabled:LIVE_SOURCE_CROSSFADE_ENABLED,completed:0,fallbacks:0,partial:0,last:null};
state.reverseHandover={attempts:0,eligible:0,blocked:0,last:null,mixed:0};
state.liveOverlapGate={attempts:0,qualified:0,blocked:0,last:null,reasons:{}};
const SOURCE_OVERLAP_SHADOW=process.env.RADIO_SOURCE_OVERLAP_SHADOW==='true';
let previousSourcePcmTail=null;
let shadowOverlap=null;
state.sourceOverlapShadow={enabled:SOURCE_OVERLAP_SHADOW,attempts:0,completed:0,blocked:0,failed:0,last:null};
function recordBoundary(event){state.lastBoundary={...event,at:new Date().toISOString()};console.info('RADIO_SOURCE_BOUNDARY',JSON.stringify(state.lastBoundary));}
const LIVE_PCM_INTAKE_ENABLED=process.env.RADIO_LIVE_PCM_INTAKE_ENABLED==='true';
const liveIntake=new LivePcmIntake();
const liveSessions=new LivePcmSessionGate();
const PUBLIC_LIVE_ENABLED=LIVE_PCM_INTAKE_ENABLED&&process.env.RADIO_PUBLIC_LIVE_ENABLED==='true';
const publicLive=new RadioPublicLiveGate();
const gatewayClock=new PcmGatewayClock();
const TIMED_PCM_SHADOW_ENABLED=LIVE_PCM_INTAKE_ENABLED&&process.env.RADIO_TIMED_PCM_SHADOW_ENABLED==='true';
const timedShadow=new RadioTimedPcmPlayout();
const PCM_MIX_LAB_ENABLED=TIMED_PCM_SHADOW_ENABLED&&process.env.RADIO_PCM_MIX_LAB_ENABLED==='true';
const pcmMixLab=new RadioIsolatedPcmLab();
const soakTelemetry=new RadioPcmLabSoakTelemetry();
const PRIVATE_PREVIEW_ENABLED=LIVE_PCM_INTAKE_ENABLED&&process.env.RADIO_PRIVATE_PCM_PREVIEW_ENABLED==='true';
const privatePreview=new RadioPrivatePcmPreview();
const PRIVATE_LIVE_ENABLED=LIVE_PCM_INTAKE_ENABLED&&process.env.RADIO_PRIVATE_LIVE_MONITOR_ENABLED==='true';
const privateLive=new RadioPrivateLivePcmQueue();
const ISOLATED_MIX_ENABLED=PRIVATE_LIVE_ENABLED&&process.env.RADIO_ISOLATED_MIX_OUTPUT_ENABLED==='true';
const ISOLATED_REAL_MUSIC_ENABLED=ISOLATED_MIX_ENABLED&&process.env.RADIO_ISOLATED_REAL_MUSIC_ENABLED==='true';
const isolatedMusicSample=ISOLATED_REAL_MUSIC_ENABLED?
  RadioIsolatedMusicSample.fromFile(process.env.RADIO_ISOLATED_MUSIC_PCM_FILE):null;
const isolatedMix=new RadioIsolatedMixOutput({musicSample:isolatedMusicSample});
// No switch command is exposed: this is passive safety telemetry only.
const switchShadow=new RadioWorkerSwitchShadow();
let shadowTicks=0;
const shadowTimer=TIMED_PCM_SHADOW_ENABLED?setInterval(()=>{
  if(!liveSessions.snapshot().active)return;
  const nowMs=Date.now();
  const result=timedShadow.tick(nowMs);
  if(PCM_MIX_LAB_ENABLED){
    const lab=pcmMixLab.tick(nowMs);
    soakTelemetry.tick(nowMs,lab);
    if(!lab.ok)state.pcmMixLabLastError=lab.reason;
  }
  shadowTicks++;
  // Deliberately discard the simulated output: NEVER forward to station encoder.
  if(!result.ok)state.timedPcmShadowLastError=result.reason;
},20):null;
shadowTimer?.unref?.();
const shadowStatus=()=>({enabled:TIMED_PCM_SHADOW_ENABLED,connectedToEncoder:false,
  ticks:shadowTicks,...timedShadow.snapshot(Date.now())});

state.livePcmIntake={enabled:LIVE_PCM_INTAKE_ENABLED,connectedToEncoder:false,...liveIntake.snapshot()};
// Saved radio jingle settings are the activation switch; ops can explicitly disable at Worker level.
const JINGLE_PLAYOUT_ENABLED=process.env.RADIO_JINGLE_PLAYOUT_ENABLED!=='false';
// An additional deployment gate is required even when the saved UI switch is enabled.
const HOURLY_SIGNAL_PCM_ENABLED=process.env.RADIO_HOURLY_SIGNAL_PCM_ENABLED==='true';

let musicSinceJingle=0,jinglesPlayed=0,jinglePending=false;
state.jingles={enabled:JINGLE_PLAYOUT_ENABLED,played:0,musicSinceJingle:0};
const hourlySignalHistory=new Set();
state.hourlySignal={stage:'SHADOW_ONLY',connectedToEncoder:false,enabled:false,last:null,nextBoundaryAt:null};
state.hourlySignal.handover=null;
// Observe configuration and predict hour-boundary action without ever changing decoder,
// source authority, or the actual MP3 output. Real PCM integration follows an on-air soak.
const hourlySignalTimer=setInterval(async()=>{
 try{
  const config=await readTimeSignal();
  const nowMs=Date.now(),boundary=hourBoundary(nowMs);
  state.hourlySignal.enabled=config.enabled;
  state.hourlySignal.nextBoundaryAt=new Date(nextHourlyBoundary(nowMs)).toISOString();
  if(!config.enabled||nowMs-boundary>Math.min(config.maxDelaySeconds*1000,60000))return;
  const current=state.playout;
  const remainingMs=current?Math.max(0,(current.durationMs||0)-(current.seekMs||0)-(current.emittedMs||0)):null;
  const plan=planHourlySignal({settings:config,nowMs,mode:state.mode,remainingMs,activeHourKeys:[...hourlySignalHistory]});
  if(hourlySignalHistory.has(plan.key)||!plan.key)return;
  hourlySignalHistory.add(plan.key);
  state.hourlySignal.last={...plan,at:new Date(nowMs).toISOString(),audible:false};
  const ready=state.hourlySignal.preflight;
  const signalReady=ready?.ok===true&&ready.assetId===plan.assetId&&ready.key?.startsWith(plan.key+':');
  // A unique hour key is used, not the selected asset ID: reusing a time
  // announcement for multiple hours remains valid. Log the exact decision
  // when the hour arrives, even if no PCM can be emitted.
  state.hourlySignal.hourCheck={
    key:plan.key,assetId:plan.assetId||null,source:state.mode,
    remainingMs,preflight:signalReady?'READY':ready?.reason||'NOT_READY',
    configEnabled:config.enabled,pcmEnabled:HOURLY_SIGNAL_PCM_ENABLED,
    at:new Date(nowMs).toISOString()
  };
  console.info('RADIO_HOURLY_HOUR_CHECK',JSON.stringify(state.hourlySignal.hourCheck));
  const handover=planHourlyTrackHandover({
   enabled:HOURLY_SIGNAL_PCM_ENABLED&&config.enabled,
   source:state.mode,atMs:nowMs,boundaryMs:boundary,
   remainingMs,thresholdSeconds:config.thresholdSeconds,
   maxDelaySeconds:config.maxDelaySeconds,mode:config.mode,
   hasSignal:signalReady,live:publicLive.onAir,
   scheduledSlotActive:!!state.slotId,
   alreadyHandled:!!state.hourlySignal.playedKey&&state.hourlySignal.playedKey===plan.key
  });
  state.hourlySignal.handover={...handover,key:plan.key,audible:false,at:new Date(nowMs).toISOString()};
  console.info('RADIO_HOURLY_HANDOVER_SHADOW',JSON.stringify(state.hourlySignal.handover));
  if(state.mode==='SCHEDULED'&&state.slotId&&signalReady){
   const slot=await prisma.radioScheduleSlot.findUnique({where:{id:state.slotId},
     select:{id:true,endAt:true,playlist:{select:{status:true}}}});
   const signal=await prisma.radioAsset.findUnique({where:{id:plan.assetId},
     select:{durationMs:true,category:true}});
   const upcoming=await prisma.radioScheduleSlot.findFirst({where:{
     startAt:{gt:new Date(nowMs)},playlist:{status:'APPROVED'}},
     select:{startAt:true},orderBy:{startAt:'asc'}});
   const admission=scheduledHourlyAdmission({
     enabled:config.enabled&&HOURLY_SIGNAL_PCM_ENABLED,
     live:publicLive.onAir,
     slot:slot?.playlist?.status==='APPROVED'?slot:null,
     nowMs,signalDurationMs:signal?.durationMs,
     fadeMs:config.fadeMs,trackRemainingMs:remainingMs,
     maxDelaySeconds:config.maxDelaySeconds,
     nextSlotStartMs:upcoming?.startAt?.getTime()??null,
     alreadyHandled:state.hourlySignal.playedKey===plan.key
   });
   state.hourlySignal.scheduledAdmission={...admission,key:plan.key,at:new Date().toISOString(),
     connectedToEncoder:false};
   if(admission.allowed){
     const scheduled=await prisma.radioScheduleSlot.findUnique({
       where:{id:slot.id},include:{playlist:{include:{
         items:{orderBy:{position:'asc'},include:{asset:true}}
       }}}
     });
     const active=resolveRadioCursor(scheduled?[scheduled]:[],nowMs,{
       scheduledCrossfade:SCHEDULED_CROSSFADE_ENABLED,
       defaultScheduledOverlapMs:SCHEDULED_DEFAULT_OVERLAP_MS
     });
     const snapshot=reserveScheduledHourlySuccessor({
       slot:active.slot,items:scheduled?.playlist?.items||[],
       interruptedIndex:active.track?.index??-1,
       nowMs,announcementMs:signal?.durationMs||0
     });
     state.hourlySignal.scheduledSuccessor={...snapshot,connectedToEncoder:false,
       key:plan.key,at:new Date().toISOString()};
     console.info('RADIO_HOURLY_SCHEDULED_CURSOR_SHADOW',
       JSON.stringify(state.hourlySignal.scheduledSuccessor));
   }
   console.info('RADIO_HOURLY_SCHEDULED_AUTHORITY_SHADOW',
     JSON.stringify(state.hourlySignal.scheduledAdmission));
  }
  console.info('RADIO_HOURLY_SIGNAL_SHADOW',JSON.stringify(state.hourlySignal.last));
  if(hourlySignalHistory.size>72)hourlySignalHistory.delete(hourlySignalHistory.values().next().value);
 }catch(e){state.hourlySignal.lastError=String(e.message||e).slice(0,160);}
},5000);
hourlySignalTimer.unref?.();
let hourlyPreflightRunning=false;
let hourlyPreflightKey=null;
const hourlyPreflightTimer=setInterval(async()=>{
 if(hourlyPreflightRunning||stopping||publicLive.onAir)return;
 const now=Date.now(),next=nextHourlyBoundary(now);
 // One safe, isolated decode check per upcoming hour; no route to station PCM.
 if(next-now>90000)return;
 const hour=(new Date(next).getUTCHours()+3)%24;
 hourlyPreflightRunning=true;
 try{
  const config=await readTimeSignal();
  if(!config.enabled)return;
  const assetId=config.hourAssetIds[hour];
  if(!assetId)return;
  const key=new Date(next).toISOString()+':'+assetId;
  if(hourlyPreflightKey===key)return;
  const asset=await prisma.radioAsset.findUnique({where:{id:assetId},
   select:{id:true,category:true,durationMs:true,storageKey:true}});
  const check=await preflightTimeSignal({asset,assetsRoot,ffmpeg});
  state.hourlySignal.preflight={key,assetId,at:new Date().toISOString(),...check};
  // A transient decoder/storage failure must be retried before the hour.
  if(check.ok)hourlyPreflightKey=key;
  console.info('RADIO_HOURLY_SIGNAL_PREFLIGHT',JSON.stringify(state.hourlySignal.preflight));
 }catch(error){state.hourlySignal.preflight={ok:false,reason:'PREFLIGHT_ERROR',at:new Date().toISOString()};
  state.hourlySignal.lastError=String(error.message||error).slice(0,160);
 }finally{hourlyPreflightRunning=false;}
},10000);
hourlyPreflightTimer.unref?.();

function authorized(req) {
  const provided=req.headers['x-radio-worker-secret'];
  if(typeof provided!=='string') return false;
  const a=Buffer.from(provided), b=Buffer.from(secret);
  return a.length===b.length && timingSafeEqual(a,b);
}
const loudnessMeter=createStationLufsMeter({ffmpeg,enabled:process.env.RADIO_LUFS_ENABLED!=='false'});
function startEncoder() {
  encoder=spawn(ffmpeg,['-hide_banner','-loglevel','error','-nostdin',
    '-f','s16le','-ar','48000','-ac','2','-i','pipe:0',
    '-c:a','libmp3lame','-b:a','128k','-ar','48000','-f','mp3','-write_xing','0','pipe:1'],
    {stdio:['pipe','pipe','pipe']});
  encoder.stdout.on('data',data=>{
    loudnessMeter.observe(data);
    state.frames+=1;
    for(const res of listeners) {
      if(!res.write(data)) {
        // Slow clients must not stall the station clock.
        listeners.delete(res); res.destroy();
      }
    }
  });
  encoder.stderr.on('data',buf=>{const msg=buf.toString().slice(-500);if(!isIgnorableMediaNotice(msg))state.lastError=msg;});
  encoder.on('error',e=>{state.lastError=e.message;});
  encoder.on('exit',()=>{if(!stopping) process.exitCode=1;});
}

const silence=Buffer.alloc(48000*2*2/5);
async function current() {
  const now=new Date(),nowMs=now.getTime();
  const slots=await prisma.radioScheduleSlot.findMany({
    where:{startAt:{lte:now},endAt:{gt:now},playlist:{status:'APPROVED'}},
    include:{playlist:{include:{items:{orderBy:{position:'asc'},include:{asset:true}}}}},
    orderBy:{startAt:'asc'},take:1
  });
  // An opt-in finish-current-track handoff shifts a single scheduled show.
  // Do not re-enter the slot at its original wall-clock offset.
  if(delayedScheduledSlot){
    // A newly scheduled show takes precedence over an older delayed one.
    const urgent=slots.find(x=>x.id!==delayedScheduledSlot.id);
    if(urgent && Date.parse(urgent.startAt)<=nowMs){
      recordBoundary({source:'SCHEDULED',reason:'NEW_SCHEDULE_PRIORITY',slotId:urgent.id});
      delayedScheduledSlot=null;
    }
  }
  if(delayedScheduledSlot){
    if(nowMs>=delayedScheduledSlot.actualEndMs){
      recordBoundary({source:'SCHEDULED',reason:'DELAYED_SCHEDULE_FINISHED',
        slotId:delayedScheduledSlot.id});
      delayedScheduledSlot=null;
    }else if(nowMs>=delayedScheduledSlot.actualStartMs){
      const delayed=await prisma.radioScheduleSlot.findUnique({
        where:{id:delayedScheduledSlot.id},
        include:{playlist:{include:{items:{orderBy:{position:'asc'},include:{asset:true}}}}}
      });
      if(delayed?.playlist?.status==='APPROVED'){
        const shifted={...delayed,startAt:new Date(delayedScheduledSlot.actualStartMs),
          endAt:new Date(delayedScheduledSlot.actualEndMs)};
        const shiftedCursor=resolveRadioCursor([shifted],nowMs,{scheduledCrossfade:SCHEDULED_CROSSFADE_ENABLED,defaultScheduledOverlapMs:SCHEDULED_DEFAULT_OVERLAP_MS});
        const asset=shiftedCursor.track?shifted.playlist.items[shiftedCursor.track.index].asset:null;
        return {cursor:shiftedCursor,asset,isLastScheduledTrack:!!shiftedCursor.track && shiftedCursor.track.index===shifted.playlist.items.length-1,
          nextTrackId:scheduledSuccessor(shifted.playlist.items,shiftedCursor),
          delayedShiftProof:{slotId:shifted.id,originalEndMs:delayed.endAt.getTime(),
            actualEndMs:delayedScheduledSlot.actualEndMs}};
      }
      delayedScheduledSlot=null;
    }
  }
  let cursor=resolveRadioCursor(slots,nowMs,{scheduledCrossfade:SCHEDULED_CROSSFADE_ENABLED,defaultScheduledOverlapMs:SCHEDULED_DEFAULT_OVERLAP_MS});
  if(LIVE_SOURCE_CROSSFADE_ENABLED&&scheduledEntryOverlap&&cursor.slot?.id===scheduledEntryOverlap.slotId){
    cursor=resumeScheduledCursor(cursor,scheduledEntryOverlap);
  }
  // Only a *confirmed* audible marker may replace the deterministic wall clock.
  // Shadow candidate reservations must never change the actual on-air cursor.
  if(confirmedScheduledHourlyReservation){
    const snapshot=confirmedScheduledHourlyReservation;
    if(!slots[0]||slots[0].id!==snapshot.slotId||
       Date.parse(slots[0].endAt)!==snapshot.slotEndMs){
      confirmedScheduledHourlyReservation=null;
    }else{
      const resumed=resolveHourlyScheduledResume(snapshot,{
        slot:slots[0],items:slots[0].playlist.items,nowMs,live:publicLive.onAir
      });
      if(resumed.ok){
        const candidate=slots[0].playlist.items[resumed.index]?.asset;
        const revised={...cursor,status:'SCHEDULED',slot:{
          id:slots[0].id,playlistId:slots[0].playlistId,
          name:slots[0].playlist.name,
          startAt:new Date(slots[0].startAt).toISOString(),
          endAt:new Date(slots[0].endAt).toISOString()
        },track:{id:resumed.assetId,name:candidate.name,index:resumed.index,
          offsetMs:resumed.seekMs,seekMs:resumed.seekMs,
          durationMs:resumed.durationMs,remainingMs:resumed.remainingMs}};
        return {cursor:revised,asset:candidate,
          isLastScheduledTrack:resumed.index===slots[0].playlist.items.length-1,
          nextTrackId:scheduledSuccessor(slots[0].playlist.items,revised)};
      }
      if(resumed.reason==='PLAYLIST_CHANGED'||resumed.reason==='SLOT_CHANGED'||
         resumed.reason==='PLAYLIST_FINISHED')confirmedScheduledHourlyReservation=null;
    }
  }
  const scheduled=cursor.track?slots[0].playlist.items[cursor.track.index].asset:null;
  const alreadyFinished=!!cursor.slot && !!finishedScheduledSlot &&
    cursor.slot.id===finishedScheduledSlot.id && nowMs<finishedScheduledSlot.endAtMs;
  if(cursor.slot && scheduled && !alreadyFinished){
    musicQueueKey=null;musicQueueNextId=null;
    return {cursor,asset:scheduled,isLastScheduledTrack:cursor.track.index===slots[0].playlist.items.length-1,
      nextTrackId:scheduledSuccessor(slots[0].playlist.items,cursor)};
  }
  // A schedule may have an unfilled wall-clock tail, or the final track may
  // have naturally ended before its nominal offset. Resume AutoDJ immediately.
  // The current active schedule (queried above) always outranks older slots.
  if(cursor.slot){
    musicQueueKey=null;musicQueueNextId=null;
  }
  const settings=await readAutoDjSettings();
  state.autoDjEnabled=settings.enabled;
  if(!settings.enabled||!settings.playlistId){musicQueueKey=null;musicQueueNextId=null;return {cursor,asset:null};}
  const playlist=await prisma.radioPlaylist.findUnique({
    where:{id:settings.playlistId},
    include:{items:{orderBy:{position:'asc'},include:{asset:true}}}
  });
  for(const [id,expires] of failedAutoDjAssets)if(expires<=nowMs)failedAutoDjAssets.delete(id);
  const catalog=cueAssets(selectAutoDjAssets(playlist).filter(asset=>!failedAutoDjAssets.has(asset.id)),await readCues());
  if(!catalog.length)return {cursor,asset:null};
  if(reverseReservedTarget){
    const reservation=reverseReservedTarget;
    const decision=validateReverseTarget(reservation,{
      nowMs,slotId:reservation.slotId,slotEndMs:reservation.slotEndMs,
      playlistId:settings.playlistId,assetIds:catalog.map(a=>a.id),
      autoDjEnabled:settings.enabled,publicLive:publicLive.onAir
    });
    reverseReservedTarget=null;
    reverseMixAuthorityAt=null;
    reverseMixAuthorityReservation=null;
    reverseReservedShift=null;
    if(decision.valid&&(!reservation.consumedFrames || (prewarmed?.assetId===reservation.assetId&&
      prewarmed.seekMs===reservation.seekMs+reservation.consumedFrames/48&&
      !prewarmed.child.killed))){
      const chosen=catalog.find(a=>a.id===reservation.assetId);
      if(chosen){
        // The reserved deck may continue playing until another scheduled
        // programme begins. Preserve that upcoming wall-clock boundary so
        // scheduled prewarm/authority and FORWARD PCM overlap can run.
        // Without this, the resumed AutoDJ cursor has until:null (Infinity)
        // and its watchdog abruptly kills the deck at the next slot.
        const nextScheduled=!settings.finishTrackBeforeSchedule
          ?await prisma.radioScheduleSlot.findFirst({
            where:{startAt:{gt:now},playlist:{status:'APPROVED'}},
            select:{startAt:true},orderBy:{startAt:'asc'}
          }):null;
        const nextBoundaryMs=nextScheduled?.startAt?.getTime()??Infinity;
        state.reverseTargetReservation.used++;
        state.reverseTargetReservation.last={status:'USED',assetId:chosen.id,at:new Date().toISOString()};
        return {cursor:{status:'AUTO_DJ',at:now.toISOString(),slot:null,
          track:{id:chosen.id,name:chosen.name,index:catalog.indexOf(chosen),
            offsetMs:(reservation.consumedFrames||0)/48,
            seekMs:reservation.seekMs+(reservation.consumedFrames||0)/48,
            durationMs:reservation.durationMs},
          until:Number.isFinite(nextBoundaryMs)?new Date(nextBoundaryMs).toISOString():null},asset:chosen};
      }
    }
    state.reverseTargetReservation.invalidated++;
    state.reverseTargetReservation.last={status:'INVALID',
      reason:decision.valid?'DECODER_NOT_PREPARED':decision.reason,at:new Date().toISOString()};
  }

  const rotationSettings=await readRotation();
  const artistGap=rotationSettings.enabled?rotationSettings.artistGap:0;
  const artistRecent=recentlyAiredArtists.slice(-artistGap);
  // Check the catalog fingerprint before running the potentially expensive
  // artist-spacing rotation. The plan is deterministic within the UTC day.
  const dayKey=new Date(nowMs).toISOString().slice(0,10);
  const key=rotationSettings.enabled?[dayKey,rotationSettings.artistGap,
    rotationSettings.cooldownMinutes,catalog.map(a=>a.id+':'+a.playDurationMs+':'+(a.tags?.artist||'')).join(',')].join('|'):null;
  if(key!==frozenRotation?.key){
    const started=performance.now();
    const candidate=rotationPlan(catalog,rotationSettings,nowMs);
    frozenRotation=null;
    if(candidate){
      const history=rotationSettings.cooldownMinutes?await readPlayoutHistory():[];
      const items=prioritizeUnplayed(candidate.items,history,rotationSettings.cooldownMinutes,nowMs);
      frozenRotation={key,plan:{...candidate,items}};
    }
    state.rotationComputeMs=Math.round(performance.now()-started);
    state.rotationComputedAt=new Date().toISOString();
  }
  const rotation=frozenRotation?.plan||null;
  const music=rotation?.items||catalog;
  const clock=rotation?nowMs-rotation.anchorMs:nowMs;
  const newQueueKey=[settings.playlistId,key||'NO_ROTATION',music.map(a=>a.id+':'+a.playDurationMs).join('|')].join(':');
  if(newQueueKey!==musicQueueKey){musicQueueKey=newQueueKey;musicQueueNextId=null;}

  // Shared on-air insertion between full music tracks, for BOTH timeline and strict rotation.
  // Public LIVE and scheduled slots always have priority and never receive jingles here.
  if(JINGLE_PLAYOUT_ENABLED&&!jinglePending&&musicSinceJingle>0){
    const jingles=await readJingles();
    if(jingles.enabled&&jingles.dayparts.includes(rotation?.daypart??(() => {const hour=new Date(nowMs+3*3600000).getUTCHours();return hour<7?'NIGHT':hour<11?'MORNING':hour<18?'DAY':'EVENING';})())
      &&jingles.assetIds.length&&musicSinceJingle%jingles.everyTracks===0){
      const nextSlot=await prisma.radioScheduleSlot.findFirst({
        where:{startAt:{gt:now},playlist:{status:'APPROVED'}},
        select:{startAt:true},orderBy:{startAt:'asc'}
      });
      const until=Math.min(nextSlot?.startAt.getTime()??Infinity,rotation?.endMs??Infinity);
      const candidates=await prisma.radioAsset.findMany({where:{id:{in:jingles.assetIds}}});
      const selected=chooseJingleAsset(jingles,candidates,jinglesPlayed);
      if(selected&&until-nowMs>=selected.durationMs+500){
        try{
          await fs.access(path.join(assetsRoot,path.basename(selected.storageKey)));
          jinglePending=true;
          state.queueStatus='JINGLE';
          return {cursor:{status:'AUTO_DJ',isJingle:true,at:now.toISOString(),slot:null,
            track:{id:selected.id,name:selected.name,index:-1,seekMs:0,offsetMs:0,
              durationMs:selected.durationMs},
            until:Number.isFinite(until)?new Date(until).toISOString():null},asset:selected};
        }catch{state.lastError='Jingle file missing: '+selected.id;}
      }
    }
  }
  // Strict mode advances only after a decoder finishes. Nothing in the
  // generated playback history changes the selection of an already playing track.
  if(rotation && rotationSettings.strictCooldown && rotationSettings.cooldownMinutes>0){
    const history=await readPlayoutHistory();
    // Honor both cooldown and artist gap. Avoid choosing another song by the
    // same artist when an eligible alternative exists.
    const avoided=new Set(artistRecent.map(name=>name.toLocaleLowerCase('ru-RU')));
    const distinct=music.filter(item=>!avoided.has(id3Artist(item).normalize('NFKC').trim().replace(/\\s+/g,' ').toLocaleLowerCase('ru-RU'))||!id3Artist(item).trim());
    const eligible=chooseQueuedTrack(distinct,history,rotationSettings.cooldownMinutes,nowMs)
      ||chooseQueuedTrack(music,history,rotationSettings.cooldownMinutes,nowMs);
    const selected=eligible||selectExhaustionFallback(
      distinct.length?distinct:music,history,nowMs,rotationSettings.allowCooldownFallback);
    state.cooldownException=!!selected&&!eligible;
    const next=await prisma.radioScheduleSlot.findFirst({
      where:{startAt:{gt:now},playlist:{status:'APPROVED'}},
      select:{startAt:true},orderBy:{startAt:'asc'}
    });
    const until=Math.min(settings.finishTrackBeforeSchedule?Infinity:next?next.startAt.getTime():Infinity,rotation.endMs);
    if(!selected || until-nowMs<150){
      state.queueStatus=selected?'BOUNDARY':'COOLDOWN_WAIT';
      return {cursor,asset:null};
    }
    state.queueStatus=eligible?'PLAYING':'FALLBACK_REPEAT';
    // Dry-run only: never initiate a second decoder without PCM handover.
    // A reserved candidate is not recorded as playback.
    const dsp=await readAudioProcessing();
    const preflight=await preflightNextTracks({items:music,history,
      cooldownMinutes:rotationSettings.cooldownMinutes,nowMs,preferredId:selected.id,
      requestedMs:dsp.crossfadeMs,untilMs:until,assetsRoot});
    state.queueCrossfadePreview={...preflight,active:false};
    const index=music.findIndex(item=>item.id===selected.id);
    return {cursor:{status:'AUTO_DJ',at:now.toISOString(),slot:null,
      track:{id:selected.id,name:selected.name,index,seekMs:selected.cue.inMs,
        offsetMs:0,durationMs:selected.playDurationMs},
      until:Number.isFinite(until)?new Date(until).toISOString():null},
      asset:selected};
  }
  state.queueStatus='SEQUENTIAL';
  // Full music tracks follow one another from their cue-in points. The old
  // cueCursor(music, wall-clock) skipped several seconds after every jingle.
  const lastIndex=resumeAutoDjAfterShow&&lastAutoDjTrackId?music.findIndex(a=>a.id===lastAutoDjTrackId):-1;
  const nextIndex=lastIndex>=0?(lastIndex+1)%music.length:musicQueueNextId?music.findIndex(a=>a.id===musicQueueNextId):-1;
  const initial=cueCursor(music,clock);
  const index=nextIndex>=0?nextIndex:initial?.index??0;
  const candidates=[...music.slice(index),...music.slice(0,index)];
  // Never restart the same short rotation cycle while unheard music remains.
  // Rotation uses actual recorded playout order; the playing decoder is not
  // affected by this selection and the full playlist remains eligible.
  const history=rotation?await readPlayoutHistory():[];
  const chosen=rotation
    ?fairNextTrack(candidates,history,artistRecent,artistGap,nowMs)
    :artistGap?preferArtistGap(candidates,artistRecent,artistGap)[0]:music[index];
  const chosenIndex=music.findIndex(item=>item.id===chosen?.id);
  const track=chosen?{id:chosen.id,name:chosen.name,index:chosenIndex,offsetMs:0,
    seekMs:chosen.cue.inMs,durationMs:chosen.playDurationMs}:null;
  const next=await prisma.radioScheduleSlot.findFirst({
    where:{startAt:{gt:now},playlist:{status:'APPROVED'}},
    select:{startAt:true},orderBy:{startAt:'asc'}
  });
  const until=Math.min(settings.finishTrackBeforeSchedule?Infinity:next?next.startAt.getTime():Infinity,rotation?.endMs??Infinity);
  if(!track || until-nowMs<150)return {cursor,asset:null};
  if(resumeAutoDjAfterShow){resumeAutoDjAfterShow=false;lastAutoDjTrackId=null;}
  return {cursor:{status:'AUTO_DJ',at:now.toISOString(),slot:null,track,
    until: Number.isFinite(until)?new Date(until).toISOString():null},
    asset:music[track.index],nextTrackId:music.length>1?music[(track.index+1)%music.length].id:null};
}

// Prediction is advisory only: the real current() authority is re-checked
// before a prepared decoder can feed the public encoder.
async function warmSuccessor({nextTrackId,musicCount,currentTrackId,scheduled=false,scheduledSlotId=null,scheduledSlotStartMs=null,reverse=false}){
  if(prewarming||prewarmed||publicLive.onAir||stopping)return;
  prewarming=true;
  try{
    const nowMs=Date.now();
    const rotation=await readRotation();
    const jingles=JINGLE_PLAYOUT_ENABLED?await readJingles():null;
    const partHour=new Date(nowMs+3*3600000).getUTCHours();
    const daypart=partHour<7?'NIGHT':partHour<11?'MORNING':partHour<18?'DAY':'EVENING';
    let candidate=null,seekMs=0,durationMs=0;
    if(!scheduled&&!reverse&&jingles?.enabled&&jingles.assetIds.length&&jingles.dayparts.includes(daypart)&&
       musicCount>0&&musicCount%jingles.everyTracks===0){
      const assets=await prisma.radioAsset.findMany({where:{id:{in:jingles.assetIds}}});
      candidate=chooseJingleAsset(jingles,assets,jinglesPlayed);
      durationMs=candidate?.durationMs||0;
    } else {
      candidate=await prisma.radioAsset.findUnique({where:{id:nextTrackId}});
      if(candidate){
        const cues=await readCues();
        const cue=cueAssets([candidate],cues)[0];
        seekMs=scheduled?0:cue?.cue.inMs||0;
        durationMs=scheduled?candidate.durationMs:cue?.playDurationMs||0;
      }
    }
    if(!candidate||durationMs<1000)return;
    const nextSlot=await prisma.radioScheduleSlot.findFirst({
      where:{startAt:{gt:new Date()},playlist:{status:'APPROVED'}},
      select:{startAt:true},orderBy:{startAt:'asc'}
    });
    if(!scheduled&&!reverse&&nextSlot&&nextSlot.startAt.getTime()-Date.now()<durationMs+500)return;
    const filename=path.join(assetsRoot,path.basename(candidate.storageKey));
    await fs.access(filename);
    const dsp=await readAudioProcessing();
    const filter=audioProcessingFilter(dsp,durationMs/1000);
    const args=['-hide_banner','-loglevel','error','-nostdin','-re',
      '-ss',String(seekMs/1000),'-i',filename,'-t',String(durationMs/1000),
      '-vn',...(filter?['-af',filter]:[]),'-f','s16le','-ac','2','-ar','48000','pipe:1'];
    if(publicLive.onAir||stopping||state.trackId!==currentTrackId)return;
    const child=spawn(ffmpeg,args,{stdio:['ignore','pipe','pipe']});
    child.stderr.on('data',()=>{});
    child.on('error',()=>{if(prewarmed?.child===child)prewarmed=null;});
    child.on('close',()=>{if(prewarmed?.child===child)prewarmed=null;});
    prewarmed={child,assetId:candidate.id,seekMs,durationMs,
      scheduledSlotId,scheduledSlotStartMs,sourceAuthorityConfirmedAt:null,argsKey:JSON.stringify(args)};
    state.transitions.prewarmed++;
  }catch(error){state.lastError='Next audio prewarm: '+error.message;}
  finally{prewarming=false;}
}

function stopDecoder() {
  discardPrewarm();
  if(decoder) { decoder.kill('SIGTERM'); decoder=null; }
}
// Schedule authority is polled independently: database latency must not block the 20-ms audio clock.
const liveScheduleTimer=PUBLIC_LIVE_ENABLED?setInterval(async()=>{
  if(!publicLive.onAir)return;
  try{
    const scheduled=await prisma.radioScheduleSlot.findFirst({
      where:{startAt:{lte:new Date()},endAt:{gt:new Date()},playlist:{status:'APPROVED'}},
      select:{id:true},
    });
    if(scheduled)publicLive.stop('SCHEDULE_PRIORITY');
  }catch{publicLive.stop('SCHEDULE_CHECK_FAILED');}
},1000):null;
liveScheduleTimer?.unref?.();

// Real scheduled route is independently gated until end-to-end PCM tests pass.
const HOURLY_SCHEDULED_PCM_ENABLED=process.env.RADIO_HOURLY_SCHEDULED_PCM_ENABLED==='true';
async function emitHourlySignalAtSafeBoundary(){
 if(!HOURLY_SIGNAL_PCM_ENABLED||stopping||publicLive.onAir||!['AUTO_DJ','SCHEDULED'].includes(state.mode))return;
 const scheduledSource=state.mode==='SCHEDULED';
 if(scheduledSource&&!HOURLY_SCHEDULED_PCM_ENABLED)return;
 const now=Date.now(),boundary=hourBoundary(now),lateness=now-boundary;
 let config;
 try{config=await readTimeSignal();}catch{return;}
 if(!config.enabled||lateness>config.maxDelaySeconds*1000)return;
 const hour=(new Date(boundary).getUTCHours()+3)%24,assetId=config.hourAssetIds[hour];
 if(!assetId)return;
 const key=new Date(boundary).toISOString();
 if(state.hourlySignal?.playedKey===key)return;
 // Preserve scheduled authority: never inject a signal while a grid slot owns the PCM.
 const scheduled=await prisma.radioScheduleSlot.findFirst({where:{
   startAt:{lte:new Date()},endAt:{gt:new Date()},playlist:{status:'APPROVED'}},select:{id:true}});
 if(scheduled&&!scheduledSource)return;
 if(!scheduled&&scheduledSource)return;
 let hourlyScheduledReservation=null;
 if(scheduledSource){
   const slot=await prisma.radioScheduleSlot.findUnique({
     where:{id:scheduled.id},include:{playlist:{include:{
       items:{orderBy:{position:'asc'},include:{asset:true}}
     }}}
   });
   if(slot?.playlist?.status!=='APPROVED'||slot.id!==state.slotId)return;
   // A natural EOF has already moved the wall clock into the next song.
   // Use the actually completed track, not the new wall-clock selection.
   const finished=lastCompletedScheduledTrack;
   if(!finished||finished.slotId!==slot.id||
     finished.playlistId!==slot.playlistId||
     Date.now()-finished.at>config.maxDelaySeconds*1000||
     slot.playlist.items[finished.index]?.asset?.id!==finished.assetId)return;
   const upcoming=await prisma.radioScheduleSlot.findFirst({where:{
     startAt:{gt:new Date(now)},playlist:{status:'APPROVED'}},
     select:{startAt:true},orderBy:{startAt:'asc'}});
   const candidate=reserveScheduledHourlySuccessor({
     slot:{id:slot.id,playlistId:slot.playlistId,endAt:slot.endAt},items:slot.playlist.items,
     interruptedIndex:finished.index,
     nowMs:now,announcementMs:0
   });
   if(!candidate.ok)return;
   hourlyScheduledReservation={candidate,slot,nextSlotStartMs:upcoming?.startAt?.getTime()??null};
 }
 const asset=await prisma.radioAsset.findUnique({where:{id:assetId},
   select:{id:true,category:true,durationMs:true,storageKey:true}});
 const ready=await preflightTimeSignal({asset,assetsRoot,ffmpeg});
 if(!ready.ok){state.hourlySignal.last={key,status:'SKIPPED',reason:ready.reason};return;}
 if(publicLive.onAir||stopping||Date.now()-boundary>config.maxDelaySeconds*1000)return;
 // Revalidate scheduling after the asynchronous FFmpeg preflight: a slot may
 // have been approved while this file was being checked.
 const newSlot=await prisma.radioScheduleSlot.findFirst({where:{
   startAt:{lte:new Date()},endAt:{gt:new Date()},playlist:{status:'APPROVED'}},select:{id:true}});
 if(scheduledSource){
   if(!newSlot||newSlot.id!==hourlyScheduledReservation.slot.id)return;
   const check=scheduledHourlyAdmission({
     enabled:true,slot:hourlyScheduledReservation.slot,
     nowMs:Date.now(),signalDurationMs:asset.durationMs,
     fadeMs:0,trackRemainingMs:0,maxDelaySeconds:config.maxDelaySeconds,
     nextSlotStartMs:hourlyScheduledReservation.nextSlotStartMs,
     live:publicLive.onAir
   });
   if(!check.allowed){
     console.info('RADIO_HOURLY_SCHEDULED_PCM_VETO',JSON.stringify({key,reason:check.reason,slotId:newSlot.id}));
     return;
   }
 }else if(newSlot)return;
 // DB unique Setting.key is a durable at-most-once fence across worker restarts.
 // Claim *before* first PCM byte; any failure is a skip, never a repeated signal.
 try{
   await prisma.setting.create({data:{key:'radio_hourly_played_'+key,value:JSON.stringify({assetId,claimedAt:new Date().toISOString()})}});
 }catch(e){if(e.code==='P2002')return;throw e;}
 state.hourlySignal.playedKey=key;
 // The hour marker is a new source, not a continuation of an earlier
 // AutoDJ/scheduled PCM overlap. Drop every stale source reservation.
 discardPrewarm();
 lastDecodedSource=null;
 previousSourcePcmTail=null;
 shadowOverlap=null;
 reverseReservedTarget=null;
 reverseMixAuthorityAt=null;
 reverseMixAuthorityReservation=null;
 scheduledEntryOverlap=null;
 musicSinceJingle=0;
 jinglePending=false;
 const file=path.join(assetsRoot,path.basename(asset.storageKey));
 const child=spawn(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-re',
   '-i',file,'-t',String(asset.durationMs/1000),'-vn','-f','s16le','-ac','2','-ar','48000','pipe:1'],
   {stdio:['ignore','pipe','pipe']});
 let bytes=0,broken=false,slotCheckBusy=false;
 const authorizedScheduledSlotId=hourlyScheduledReservation?.slot.id||null;
 const slotGuard=setInterval(async()=>{
   if(slotCheckBusy||broken||stopping||publicLive.onAir)return;
   slotCheckBusy=true;
   try{
     const active=await prisma.radioScheduleSlot.findFirst({where:{
       startAt:{lte:new Date()},endAt:{gt:new Date()},playlist:{status:'APPROVED'}},select:{id:true}});
     if(!hourlySlotStillAuthorized({expectedSlotId:authorizedScheduledSlotId,activeSlotId:active?.id||null})){broken=true;child.kill('SIGTERM');}
   }catch{broken=true;child.kill('SIGTERM');}
   finally{slotCheckBusy=false;}
 },500);
 child.on('error',()=>{broken=true;});
 child.stderr.on('data',buf=>{state.lastError='Hour signal decoder: '+buf.toString().slice(-160);});
 try{
   state.mode='TIME_SIGNAL';state.trackId=asset.id;state.playout=null;
   for await(const pcm of child.stdout){
     if(stopping||publicLive.onAir){child.kill('SIGTERM');broken=true;break;}

     if(!encoder.stdin.write(pcm))await new Promise(resolve=>encoder.stdin.once('drain',resolve));
     bytes+=pcm.length;
   }
 }catch{broken=true;child.kill('SIGTERM');}
 clearInterval(slotGuard);
 if(!publicLive.onAir){
   const nextSlot=await prisma.radioScheduleSlot.findFirst({where:{
     startAt:{lte:new Date()},endAt:{gt:new Date()},playlist:{status:'APPROVED'}},select:{id:true}});
   if(!hourlySlotStillAuthorized({expectedSlotId:authorizedScheduledSlotId,activeSlotId:nextSlot?.id||null}))broken=true;
 }
 // The next run() cycle must select a fresh source. No stale TIME_SIGNAL
 // identity is retained as the current music track.
 state.playout=null;
 state.trackId=null;
 state.slotId=null;
 if(hourlyScheduledReservation&&!broken&&bytes>=PCM_BYTES_PER_MS*1000){
   const fresh=await prisma.radioScheduleSlot.findUnique({where:{id:hourlyScheduledReservation.slot.id},
     include:{playlist:{include:{items:{orderBy:{position:'asc'},include:{asset:true}}}}}});
   const nextTrack=hourlyScheduledReservation.candidate;
   const candidate={...nextTrack,resumeAfterMs:Date.now(),slotEndMs:Date.parse(fresh?.endAt)};
   const verified=resolveScheduledHourlySuccessor(candidate,{
     slot:fresh?.playlist?.status==='APPROVED'?fresh:null,
     items:fresh?.playlist?.items,nowMs:Date.now(),live:publicLive.onAir
   });
   if(verified.ok){
     confirmedScheduledHourlyReservation=candidate;
     lastCompletedScheduledTrack=null;
     console.info('RADIO_HOURLY_SCHEDULED_RESUME_COMMITTED',JSON.stringify({
       key,slotId:candidate.slotId,assetId:candidate.targetAssetId,
       index:candidate.targetIndex,resumeAfterMs:candidate.resumeAfterMs
     }));
   }else{
     console.warn('RADIO_HOURLY_SCHEDULED_RESUME_VETO',JSON.stringify({key,reason:verified.reason}));
   }
 }
 state.hourlySignal.last={key,assetId,status:broken?'INTERRUPTED':'EMITTED',emittedMs:Math.round(bytes/PCM_BYTES_PER_MS),at:new Date().toISOString()};
 console.info('RADIO_HOURLY_SIGNAL_PCM',JSON.stringify(state.hourlySignal.last));
}
async function run() {
  startEncoder();
  while(!stopping) {
    if(publicLive.onAir){
      reverseReservedTarget=null;reverseMixAuthorityAt=null;
      lastDecodedSource=null;
      previousSourcePcmTail=null;
      shadowOverlap=null;
      discardPrewarm();musicQueueKey=null;musicQueueNextId=null;
      state.mode='LIVE';state.trackId=null;state.slotId=null;state.playout=null;state.nextTrackId=null;
      const frame=publicLive.take(Date.now());
      if(frame){if(!encoder.stdin.write(frame))await new Promise(resolve=>encoder.stdin.once('drain',resolve));await new Promise(resolve=>setTimeout(resolve,20));}
      continue;
    }
    // Revalidate the scheduled candidate against the authoritative slot and
    // playlist before considering it for promotion to audible PCM.
    if(HOURLY_SCHEDULED_PCM_ENABLED&&HOURLY_SIGNAL_PCM_ENABLED&&
       state.mode==='SCHEDULED'&&state.hourlySignal?.scheduledSuccessor?.ok&&
       state.hourlySignal.scheduledPcmGate?.key!==state.hourlySignal.scheduledSuccessor.key){
      const candidate=state.hourlySignal.scheduledSuccessor;
      try{
        const slot=await prisma.radioScheduleSlot.findUnique({
          where:{id:candidate.slotId},include:{playlist:{include:{
            items:{orderBy:{position:'asc'},include:{asset:true}}
          }}}
        });
        const validation=resolveScheduledHourlySuccessor(candidate,{
          slot:slot?.playlist?.status==='APPROVED'?slot:null,
          items:slot?.playlist?.items,nowMs:Date.now(),live:publicLive.onAir
        });
        state.hourlySignal.scheduledPcmGate={
          enabled:true,connectedToEncoder:false,
          reason:validation.ok?'PCM_COMMIT_NOT_ARMED':validation.reason,
          validAt:new Date().toISOString(),key:candidate.key,
          assetId:validation.ok?validation.assetId:null
        };
        console.info('RADIO_HOURLY_SCHEDULED_PCM_GATE',
          JSON.stringify(state.hourlySignal.scheduledPcmGate));
      }catch(e){state.hourlySignal.scheduledPcmGate={
        enabled:true,connectedToEncoder:false,reason:'AUTHORITY_CHECK_FAILED',
        key:state.hourlySignal.scheduledSuccessor?.key,
        at:new Date().toISOString()};
      }
    }
    // First opt-in PCM stage: insert only after natural AutoDJ song completion.
    // Never preempt a song or an approved scheduled slot in this rollout.
    try{await emitHourlySignalAtSafeBoundary();}catch(e){state.hourlySignal.lastError=String(e.message||e).slice(0,160);}
    let cursor,asset,nextTrackId,isLastScheduledTrack,delayedShiftProof;
    try { ({cursor,asset,nextTrackId,isLastScheduledTrack,delayedShiftProof}=await current()); }
    catch(e) { state.lastError=e.message; state.mode='ERROR'; await new Promise(r=>setTimeout(r,1000));continue; }
    state.slotId=cursor.slot?.id||null;
    if(!asset) {
      if(!reverseReservedTarget)reverseMixAuthorityAt=null;
      lastDecodedSource=null;
      discardPrewarm();
      state.mode='SILENCE';state.trackId=null;state.playout=null;state.nextTrackId=null;
      for(let i=0;i<5&&!stopping;i++) {
        if(publicLive.onAir)break;
        if(!encoder.stdin.write(silence)) await new Promise(r=>encoder.stdin.once('drain',r));
        await new Promise(r=>setTimeout(r,200));
      }
      continue;
    }
    state.mode=cursor.isJingle?'JINGLE':cursor.status==='AUTO_DJ'?'AUTO_DJ':'SCHEDULED';state.trackId=asset.id;state.playout=null;
    if(cursor.status==='AUTO_DJ' && state.lastBoundary?.source==='SCHEDULED' && Date.now()-Date.parse(state.lastBoundary.at)<50000){recordBoundary({source:'AUTO_DJ',reason:'POST_SCHEDULE_RESUME',trackId:asset.id});}
    state.nextTrackId=cursor.status==='AUTO_DJ'&&!cursor.isJingle?nextTrackId||null:null;
    const boundary=cursor.status==='AUTO_DJ'?(cursor.until?Date.parse(cursor.until):Infinity):Date.parse(cursor.slot.endAt);
    const remaining=Math.max(0,Math.min(cursor.track.remainingMs??(cursor.track.durationMs-cursor.track.offsetMs),boundary-Date.now()));
    if(remaining<150) continue;
    const filename=path.join(assetsRoot,path.basename(asset.storageKey));
    try {await fs.access(filename);} catch(error) {
      state.lastError='Audio missing: '+asset.id;
      if(cursor.isJingle)jinglePending=false;
      if(cursor.status==='AUTO_DJ')failedAutoDjAssets.set(asset.id,Date.now()+300000);
      await new Promise(resolve=>setTimeout(resolve,250));
      continue;
    }
    // Source authority is checked before evaluating a cross-mode transition.
    // This is intentionally a fail-closed admission/telemetry gate. It does NOT
    // claim a live overlap until two PCM decoders have actually been mixed.
    if(lastDecodedSource&&lastDecodedSource.mode!==cursor.status&&
      ['AUTO_DJ','SCHEDULED'].includes(lastDecodedSource.mode)&&
      ['AUTO_DJ','SCHEDULED'].includes(cursor.status)){
      const authorityKnown=!!cursor.slot || cursor.status==='AUTO_DJ';
      const handover=reserveSourceTransition({
        source:lastDecodedSource,target:{id:asset.id,mode:cursor.status},
        sourceReady:lastDecodedSource.emittedMs>=250&&Date.now()-lastDecodedSource.at<5000,
        targetReady:!!prewarmed&&prewarmed.assetId===asset.id&&!prewarmed.child.killed,
        slotKnown:authorityKnown,scheduledActive:cursor.status==='SCHEDULED',
        publicLive:publicLive.onAir,overlapMs:1500
      });
      state.sourceHandover.last={
        from:lastDecodedSource.mode,to:cursor.status,fromId:lastDecodedSource.id,
        toId:asset.id,admissible:handover.allowed,reason:handover.reason||null,
        mixed:false,at:new Date().toISOString()
      };
      if(handover.allowed)state.sourceHandover.eligible++;
      else state.sourceHandover.blocked++;
    }
    if(SOURCE_OVERLAP_SHADOW&&lastDecodedSource&&lastDecodedSource.mode!==cursor.status&&
      previousSourcePcmTail?.length&&['AUTO_DJ','SCHEDULED'].includes(cursor.status)&&
      ['AUTO_DJ','SCHEDULED'].includes(lastDecodedSource.mode)){
      const overlap=new RadioSourcePcmOverlap({
        source:{id:lastDecodedSource.id,mode:lastDecodedSource.mode},
        target:{id:asset.id,mode:cursor.status},overlapMs:1500,curve:'equalPower'
      });
      const decision=overlap.start({
        sourceReady:previousSourcePcmTail.length>=1500*PCM_BYTES_PER_MS,
        targetReady:!!prewarmed&&prewarmed.assetId===asset.id&&!prewarmed.child.killed,
        slotAuthority:!!cursor.slot||cursor.status==='AUTO_DJ',
        publicLive:publicLive.onAir
      });
      state.sourceOverlapShadow.attempts++;
      if(decision.ok){
        shadowOverlap={engine:overlap,tail:previousSourcePcmTail,sourceOffset:0};
      }else{
        state.sourceOverlapShadow.blocked++;
        state.sourceOverlapShadow.last={phase:'BLOCKED',reason:decision.reason,
          fromId:lastDecodedSource.id,toId:asset.id,at:new Date().toISOString()};
      }
    }
    previousSourcePcmTail=null;
    // A new per-track decoder receives the latest settings. The shared encoder
    // remains alive and scheduled boundaries keep priority over DSP effects.
    let dsp;
    try {dsp=await readAudioProcessing();}catch(error){state.lastError=error.message;dsp={enabled:false,loudnessTarget:-16,truePeak:-2,fadeMs:0,crossfadeMs:0};}
    state.audioProcessing={enabled:dsp.enabled,loudnessTarget:dsp.loudnessTarget,truePeak:dsp.truePeak,fadeMs:dsp.fadeMs,crossfadeMs:dsp.crossfadeMs};
    const filter=audioProcessingFilter(dsp,remaining/1000);
    const blend=(cursor.status==='AUTO_DJ'||(cursor.status==='SCHEDULED'&&SCHEDULED_CROSSFADE_ENABLED))?cursor.track.blend:null;
    let args;
    let usableBlend=blend;
    if(usableBlend){
      state.transitions.crossfadeAttempted++;
      const candidate=path.join(assetsRoot,path.basename(usableBlend.nextStorageKey));
      try {await fs.access(candidate);}
      catch {
        state.lastError='Crossfade: next audio unavailable '+usableBlend.nextId;
        usableBlend=null;
        state.transitions.crossfadeFallbacks++;
      }
    }
    if(usableBlend){
      const nextFilename=path.join(assetsRoot,path.basename(usableBlend.nextStorageKey));
      const fullSeconds=usableBlend.overlapMs/1000;
      const shape=usableBlend.curve==='linear'?'tri':usableBlend.curve==='sCurve'?'qsin':'hsin';
      const blendStart=usableBlend.blendPosition/1000;
      // Build the complete overlap and discard its elapsed portion. Starting the
      // filter at zero would otherwise restart gain curves after Worker recovery.
      const firstSeek=(cursor.track.seekMs-usableBlend.blendPosition)/1000;
      const secondSeek=(usableBlend.nextSeekMs-usableBlend.blendPosition)/1000;
      args=['-hide_banner','-loglevel','error','-nostdin','-re',
        '-ss',String(firstSeek),'-t',String(fullSeconds),'-i',filename,
        '-re','-ss',String(secondSeek),'-t',String(fullSeconds),'-i',nextFilename,
        '-filter_complex','[0:a][1:a]acrossfade=d='+fullSeconds+':c1='+shape+':c2='+shape+',atrim=start='+blendStart+':duration='+(remaining/1000)+',asetpts=PTS-STARTPTS[m]',
        '-map','[m]','-f','s16le','-ac','2','-ar','48000','pipe:1'];
    } else {
      args=['-hide_banner','-loglevel','error','-nostdin','-re',
        '-ss',String((cursor.track.seekMs??cursor.track.offsetMs)/1000),'-i',filename,
        '-t',String(remaining/1000),'-vn',...(filter?['-af',filter]:[]),
        '-f','s16le','-ac','2','-ar','48000','pipe:1'];
    }
    const prepared=prewarmed;
    const matches=prepared&&prepared.assetId===asset.id&&prepared.seekMs===(cursor.track.seekMs??cursor.track.offsetMs)&&Math.abs(prepared.durationMs-remaining)<1200&&!prepared.child.killed;
    if(matches){decoder=prepared.child;prewarmed=null;state.transitions.used++;}
    else{discardPrewarm();decoder=spawn(ffmpeg,args,{stdio:['ignore','pipe','pipe']});if(prepared)state.transitions.missed++;}
    const child=decoder;
    // Upcoming hard-start schedule takes precedence over AutoDJ prewarm.
    // This prepares the first scheduled decoder ahead of time without routing it
    // to the encoder until the authoritative schedule cursor selects it.
    let scheduledPrewarmRequested=false;
    const gridCrossfadeEnabled=process.env.RADIO_GRID_TO_GRID_CROSSFADE_ENABLED==='true';
    let sourceClockPlanned=false;
    let reverseClockPlanned=false;
    let crossfadeAuthorityRequested=false;
    let overlapDecisionLogged=false;
    let reverseAuthorityInFlight=false;
    // An admin can disable Auto-DJ or schedule a new broadcast while a song is playing.
    // Interrupt the decoder promptly; the shared encoder stays alive.
    let polling=false;
    const watchdog=cursor.status==='AUTO_DJ'?setInterval(async()=>{
      if(polling||stopping||decoder!==child)return;
      polling=true;
      try {
        const settings=await readAutoDjSettings();
        const scheduled=await prisma.radioScheduleSlot.findFirst({
          where:{startAt:{lte:new Date()},endAt:{gt:new Date()},playlist:{status:'APPROVED'}},
          select:{id:true,startAt:true,endAt:true}
        });
        if(!settings.enabled||!settings.playlistId)child.kill('SIGTERM');
        else if(scheduled){
          if(settings.finishTrackBeforeSchedule && !cursor.isJingle && !publicLive.onAir){
            pendingScheduledHandover={id:scheduled.id,originalStartMs:scheduled.startAt.getTime(),
              originalEndMs:scheduled.endAt.getTime()};
          }else child.kill('SIGTERM');
        }
        else {
          const playlist=await prisma.radioPlaylist.findUnique({
            where:{id:settings.playlistId},select:{status:true}
          });
          if(playlist?.status!=='APPROVED')child.kill('SIGTERM');
        }
      }catch(error){state.lastError=error.message;}
      finally{polling=false;}
    },3000):null;
    // An admin may remove an active broadcast. Revoke the old decoder promptly;
    // the next cursor selection chooses an approved replacement or AutoDJ.
    const activeSlotWatchdog=cursor.status==='SCHEDULED'&&cursor.slot?.id
      ?setInterval(async()=>{
        if(stopping||decoder!==child||publicLive.onAir)return;
        try{
          const slot=await prisma.radioScheduleSlot.findUnique({
            where:{id:cursor.slot.id},select:{id:true,playlistId:true,endAt:true,
              playlist:{select:{status:true}}}
          });
          if(!slot||slot.playlistId!==cursor.slot.playlistId||
             slot.playlist?.status!=='APPROVED'||slot.endAt.getTime()<=Date.now()){
            recordBoundary({source:'SCHEDULED',reason:'SLOT_REVOKED',
              slotId:cursor.slot.id,trackId:asset.id});
            child.kill('SIGTERM');
          }
        }catch(error){state.lastError='Schedule revocation check: '+error.message;}
      },1000):null;
    let hourlyInterrupt=false;
    let hourlyFadeAtBytes=null;
    let hourlyCutAtBytes=null;
    let hourlyPollBusy=false;
    const hourlyDecisionLogged=new Set();
    const hourlyDecision=(key,reason,extra={})=>{
      const dedupe=key+':'+reason;
      if(hourlyDecisionLogged.has(dedupe))return;
      hourlyDecisionLogged.add(dedupe);
      if(hourlyDecisionLogged.size>24)hourlyDecisionLogged.delete(hourlyDecisionLogged.values().next().value);
      console.info('RADIO_HOURLY_TRACK_GATE',JSON.stringify({key,reason,source:cursor.status,trackId:asset.id,...extra,at:new Date().toISOString()}));
    };
    // Separate opt-in for scheduled music; do not interfere with overlap or jingles.
    const scheduledHourlySource=HOURLY_SCHEDULED_PCM_ENABLED&&cursor.status==='SCHEDULED';
    const hourlyTrackTimer=HOURLY_SIGNAL_PCM_ENABLED&&
      (cursor.status==='AUTO_DJ'&&!cursor.isJingle||scheduledHourlySource)
      ?setInterval(async()=>{
        if(hourlyPollBusy||stopping||publicLive.onAir||decoder!==child||hourlyInterrupt||hourlyFadeAtBytes!==null)return;
        hourlyPollBusy=true;
        try{
          const config=await readTimeSignal();
          const now=Date.now(),hour=hourBoundary(now);
          if(!config.enabled||now-hour>config.maxDelaySeconds*1000)return;
          const key=new Date(hour).toISOString();
          if(state.hourlySignal.playedKey===key)return;
          const itemId=config.hourAssetIds[(new Date(hour).getUTCHours()+3)%24];
          if(!itemId){hourlyDecision(key,'NO_CONFIGURED_AUDIO');return;}
          if(state.hourlySignal.preflight?.key!==key+':'+itemId||state.hourlySignal.preflight?.ok!==true){hourlyDecision(key,'PREFLIGHT_NOT_READY',{assetId:itemId});return;}
          const remainingPcm=Math.max(0,remaining-emittedBytes/PCM_BYTES_PER_MS);
          const plan=planHourlyTrackHandover({
            enabled:true,source:cursor.status,atMs:now,boundaryMs:hour,remainingMs:remainingPcm,
            thresholdSeconds:config.thresholdSeconds,maxDelaySeconds:config.maxDelaySeconds,
            mode:config.mode,hasSignal:true,live:publicLive.onAir
          });
          if(plan.action!=='FADE_AND_ADVANCE'){
            hourlyDecision(key,plan.reason||plan.action,{action:plan.action,remainingPcm});
            return;
          }
          const slot=await prisma.radioScheduleSlot.findFirst({where:{
            startAt:{lte:new Date(now+config.fadeMs+3000)},endAt:{gt:new Date(now)},
            playlist:{status:'APPROVED'}},select:{id:true}});
          if(cursor.status==='AUTO_DJ'&&slot){hourlyDecision(key,'SCHEDULED_SLOT_PRIORITY',{slotId:slot.id});return;}
          if(scheduledHourlySource){
            if(!slot||slot.id!==cursor.slot.id||!nextTrackId)return;
            const [fullSlot,signal,nextSlot]=await Promise.all([
              prisma.radioScheduleSlot.findUnique({where:{id:slot.id},
                include:{playlist:{include:{items:{orderBy:{position:'asc'},include:{asset:true}}}}}}),
              prisma.radioAsset.findUnique({where:{id:itemId},
                select:{id:true,durationMs:true,category:true}}),
              prisma.radioScheduleSlot.findFirst({where:{
                startAt:{gt:new Date(now)},playlist:{status:'APPROVED'}},
                select:{startAt:true},orderBy:{startAt:'asc'}})
            ]);
            if(fullSlot?.playlist?.status!=='APPROVED'||signal?.category!=='TIME_SIGNAL'||
               fullSlot.playlist.items[cursor.track.index]?.asset?.id!==asset.id||
               fullSlot.playlist.items[cursor.track.index+1]?.asset?.id!==nextTrackId)return;
            const authority=scheduledHourlyAdmission({
              enabled:true,live:publicLive.onAir,slot:fullSlot,nowMs:now,
              signalDurationMs:signal.durationMs,fadeMs:config.fadeMs,
              trackRemainingMs:remainingPcm,trackCategory:asset.category,
              maxDelaySeconds:config.maxDelaySeconds,
              nextSlotStartMs:nextSlot?.startAt?.getTime()??null
            });
            if(!authority.allowed)return;
          }
          if(publicLive.onAir||decoder!==child){hourlyDecision(key,publicLive.onAir?'LIVE_PRIORITY':'DECODER_CHANGED');return;}
          // Fade out PCM already in the outgoing decoder; let the normal
          // per-track cleanup advance the queue before emitting the time signal.
          const fadeBytes=Math.max(4,Math.floor(config.fadeMs*PCM_BYTES_PER_MS/4)*4);
          // Abort any outstanding musical overlap and its reserved decoder:
          // the hour announcement must not be mixed with stale second-deck PCM.
          liveMixDisabled=true;
          // A two-deck overlap can already own a decoder/iterator when the
          // hourly marker is armed. Shut down its target before the next PCM
          // packet; otherwise its tail might leak after the time signal.
          if(liveMixSession){
            // AsyncIterator.return() returns a promise. Handle rejection to
            // avoid an unhandled rejection crashing the worker mid-hour.
            try{Promise.resolve(liveMixSession.iterator?.return?.()).catch(
              e=>{state.lastError='Hourly overlap close: '+String(e.message||e).slice(0,120);}
            );}catch(e){state.lastError='Hourly overlap close: '+String(e.message||e).slice(0,120);}
            liveMixSession=null;
          }
          // preparedSlot is block-scoped inside the PCM packet loop.
          // The timer runs outside that scope; prewarmed is the canonical
          // second-deck handle visible here.
          const hourlyPreparedSlot=prewarmed;
          if(hourlyPreparedSlot?.child&&!hourlyPreparedSlot.child.killed){
            try{hourlyPreparedSlot.child.kill('SIGTERM');}catch{}
          }
          if(prewarmed)discardPrewarm();
          console.info('RADIO_HOURLY_CROSSFADE_PREEMPT',JSON.stringify({
            key,trackId:asset.id,source:cursor.status,
            at:new Date().toISOString()
          }));
          hourlyFadeAtBytes=emittedBytes;
          hourlyCutAtBytes=emittedBytes+fadeBytes;
          state.hourlySignal.pendingInterrupt={key,assetId:asset.id,nextTrackId:nextTrackId||null};
          console.info('RADIO_HOURLY_INTERRUPT_ARMED',JSON.stringify({key,trackId:asset.id,nextTrackId:nextTrackId||null,remainingPcm,fadeMs:config.fadeMs}));
        }catch(error){state.hourlySignal.lastError='Hour interrupt: '+error.message;
          hourlyDecision(new Date(hourBoundary(Date.now())).toISOString(),'INTERRUPT_ERROR',{message:String(error.message||error).slice(0,160)});
        }
        finally{hourlyPollBusy=false;}
      },250):null;
    let ended=false, exitCode=null;
    let truncatedAtBoundary=false;
    child.stderr.on('data',buf=>{const msg=buf.toString().slice(-500);if(!isIgnorableMediaNotice(msg))state.lastError=msg;});
    child.on('error',e=>{state.lastError=e.message;});
    child.on('close',code=>{ended=true;exitCode=code;});
    let emittedBytes=0;
    let warmRequested=false;
    const playedStart=Date.now();
    // Shadow observes PCM already sent into the persistent encoder.
    // The legacy route remains solely responsible for output until promoted.
    const stationClock=STATION_DUAL_DECK_SHADOW_ENABLED&&Number.isFinite(boundary)&&
      boundary>playedStart?new RadioStationPcmClock({overlapMs:LIVE_SOURCE_OVERLAP_MS}):null;
    const stationDeck=stationClock?new RadioStationDualDeck({overlapMs:LIVE_SOURCE_OVERLAP_MS}):null;
    if(stationClock)stationClock.arm({sourceId:asset.id,boundaryMs:boundary,startAtMs:playedStart});
    let stationClockObservedBytes=0;
    let stationClockLogged=false;
    const fadeIn=!usableBlend&&((cursor.status==='SCHEDULED'&&!SCHEDULED_CROSSFADE_ENABLED)||cursor.status==='AUTO_DJ');
    const fadeOut=!usableBlend&&((cursor.status==='SCHEDULED'&&!SCHEDULED_CROSSFADE_ENABLED)||(cursor.status==='AUTO_DJ'&&Number.isFinite(boundary)));
    const scheduledBoundaryFadeEnabled=process.env.RADIO_SCHEDULED_BOUNDARY_FADE_ENABLED==='true';
    const fadeTotalBytes=Math.max(0,Math.floor(remaining*PCM_BYTES_PER_MS/4)*4);
    state.playout={trackId:asset.id,startedAt:null,seekMs:Math.max(0,cursor.track.offsetMs??0),durationMs:Math.max(0,cursor.track.durationMs??asset.durationMs??0),emittedMs:0};
    const pcmStaging=PCM_STAGING_ENABLED?new PcmFrameBuffer({frameBytes:4,maxBytes:2*1024*1024}):null;
    const playbackStartedAt=new Date().toISOString();
    const crossfadeStartedAt=usableBlend?Date.now():null;
    let liveMixSession=null;
    let liveMixDisabled=false;
    try {
      const pcmChunks=matches&&prepared.iterator?continuePcmIterator(prepared.iterator):child.stdout;
      for await(const chunk of pcmChunks) {
        if(stopping||publicLive.onAir) {child.kill('SIGTERM');break;}
        const decoded=pcmStaging?pcmStaging.push(chunk):chunk;
        if(!decoded?.length)continue;
        if(publicLive.onAir){child.kill('SIGTERM');break;}
        // Stop an oversize or late FFmpeg chunk from spilling across the grid
        // boundary into the shared MP3 encoder heard by both site and agent.
        const gated=cursor.status==='SCHEDULED'
          ?boundScheduledPcm(decoded,Date.parse(cursor.slot.endAt),Date.now())
          :{pcm:decoded,truncated:false};
        const output=LIVE_SOURCE_CROSSFADE_ENABLED&&cursor.status==='AUTO_DJ'&&Number.isFinite(boundary)
          ?gated.pcm.subarray(0,Math.max(0,fadeTotalBytes-emittedBytes)) :gated.pcm;
        if(output.length){
          // Opt-in real PCM route for a hard AutoDJ -> scheduled boundary.
          // Use the PCM clock to split a packet exactly at the overlap start;
          // the prepared scheduled decoder supplies fresh frames concurrently.
          const preparedSlot=prewarmed;
          const reverseEligible=LIVE_SOURCE_CROSSFADE_ENABLED&&cursor.status==='SCHEDULED'&&
            isLastScheduledTrack&&!usableBlend&&!publicLive.onAir&&
            reverseReservedTarget?.slotId===cursor.slot.id&&
            reverseReservedTarget.slotEndMs===boundary&&
            preparedSlot?.assetId===reverseReservedTarget.assetId&&
            (liveMixSession?.direction==='REVERSE'||
              (preparedSlot.seekMs===reverseReservedTarget.seekMs&&!preparedSlot.iterator))&&
            !preparedSlot.child.killed&&
            (liveMixSession?.direction==='REVERSE'||
              (reverseMixAuthorityReservation===reverseReservedTarget&&
                reverseAuthorityFresh({confirmedAtMs:reverseMixAuthorityAt,nowMs:Date.now(),boundaryMs:boundary})))&&
            remaining>=LIVE_SOURCE_OVERLAP_MS&&!liveMixDisabled&&
            (liveMixSession||isPcmBoundaryAligned({remainingMs:remaining,emittedBytes,boundaryMs:boundary,nowMs:Date.now(),bytesPerMs:PCM_BYTES_PER_MS}))&&
            (liveMixSession||emittedBytes<=Math.max(0,fadeTotalBytes-LIVE_SOURCE_OVERLAP_BYTES))&&
            (liveMixSession||Math.abs((boundary-Date.now())-
              (fadeTotalBytes-emittedBytes)/PCM_BYTES_PER_MS)<900);
          const forwardEligible=LIVE_SOURCE_CROSSFADE_ENABLED&&cursor.status==='AUTO_DJ'&&!cursor.isJingle&&
            !usableBlend&&!publicLive.onAir&&!pendingScheduledHandover&&
            Number.isFinite(boundary)&&remaining>=LIVE_SOURCE_OVERLAP_MS&&
            preparedSlot?.scheduledSlotStartMs===boundary&&!!preparedSlot.scheduledSlotId&&
            (liveMixSession?.direction==='FORWARD'||!preparedSlot.iterator)&&
            !preparedSlot.child.killed&&!liveMixDisabled&&
            (liveMixSession?.direction==='FORWARD'||
              (!!preparedSlot.sourceAuthorityConfirmedAt&&
               preparedSlot.sourceAuthorityConfirmedAt<=Date.now()&&
               Date.now()<boundary))&&
            (liveMixSession||emittedBytes<=Math.max(0,fadeTotalBytes-LIVE_SOURCE_OVERLAP_BYTES))&&
            (liveMixSession||Math.abs((boundary-Date.now())-
              (fadeTotalBytes-emittedBytes)/PCM_BYTES_PER_MS)<900);
          const gridEligible=gridCrossfadeEnabled&&LIVE_SOURCE_CROSSFADE_ENABLED&&
            cursor.status==='SCHEDULED'&&isLastScheduledTrack&&!usableBlend&&!publicLive.onAir&&
            Number.isFinite(boundary)&&remaining>=LIVE_SOURCE_OVERLAP_MS&&
            preparedSlot?.scheduledSlotStartMs===boundary&&!!preparedSlot.scheduledSlotId&&
            !preparedSlot.child.killed&&!liveMixDisabled&&
            (liveMixSession?.direction==='FORWARD'||!preparedSlot.iterator)&&
            (liveMixSession?.direction==='FORWARD'||!!preparedSlot.sourceAuthorityConfirmedAt)&&
            (liveMixSession||emittedBytes<=Math.max(0,fadeTotalBytes-LIVE_SOURCE_OVERLAP_BYTES))&&
            (liveMixSession||Math.abs((boundary-Date.now())-
              (fadeTotalBytes-emittedBytes)/PCM_BYTES_PER_MS)<900);
          // Hourly speech has higher priority than music-to-music overlap.
          // Suppress dual-deck mixing once hourly fade is armed.
          const eligible=hourlyFadeAtBytes===null&&(forwardEligible||reverseEligible||gridEligible);
          if(LIVE_SOURCE_CROSSFADE_ENABLED&&!liveMixSession&&!liveMixDisabled&&
             ['AUTO_DJ','SCHEDULED'].includes(cursor.status)&&
             Number.isFinite(boundary)&&remaining>=LIVE_SOURCE_OVERLAP_MS&&
             boundary-Date.now()<5500&&boundary-Date.now()>0&&
             (cursor.status==='AUTO_DJ'?!!prewarmed||boundary-Date.now()<1700:
               !!isLastScheduledTrack)){
            const reason=eligible?'READY':!prewarmed?'NO_PREWARM':
              prewarmed.child.killed?'DECODER_EXITED':
              cursor.status==='SCHEDULED'&&!reverseReservedTarget?'NO_REVERSE_RESERVATION':
              cursor.status==='SCHEDULED'&&!reverseMixAuthorityAt?'REVERSE_AUTHORITY':
              cursor.status==='AUTO_DJ'&&!prewarmed.scheduledSlotId?'NOT_SCHEDULED_TARGET':
              cursor.status==='AUTO_DJ'&&!prewarmed.sourceAuthorityConfirmedAt?'FORWARD_AUTHORITY':
              emittedBytes>Math.max(0,fadeTotalBytes-LIVE_SOURCE_OVERLAP_BYTES)?'MISSED_PCM_WINDOW':
              'TIMELINE_OR_IDENTITY';
            state.liveOverlapGate.attempts++;
            if(eligible)state.liveOverlapGate.qualified++;
            else {state.liveOverlapGate.blocked++;
              state.liveOverlapGate.reasons[reason]=(state.liveOverlapGate.reasons[reason]||0)+1;}
            if(state.liveOverlapGate.last?.reason!==reason)
              console.log('RADIO_CROSSFADE_GATE',JSON.stringify({reason,mode:cursor.status,
                slotId:cursor.slot?.id||null,trackId:asset.id,
                targetId:prewarmed?.assetId||null,
                remainingMs:Math.round(remaining-emittedBytes/PCM_BYTES_PER_MS),
                boundaryInMs:Math.round(boundary-Date.now()),at:new Date().toISOString()}));
            state.liveOverlapGate.last={reason,mode:cursor.status,at:new Date().toISOString()};
          }
          if(LIVE_SOURCE_CROSSFADE_ENABLED&&!overlapDecisionLogged&&
            Number.isFinite(boundary)&&boundary-Date.now()<=2400&&boundary-Date.now()>0&&
            (cursor.status==='SCHEDULED'?isLastScheduledTrack:cursor.status==='AUTO_DJ')){
            overlapDecisionLogged=true;
            const timeLeft=boundary-Date.now();
            const audioLeft=(fadeTotalBytes-emittedBytes)/PCM_BYTES_PER_MS;
            console.info('RADIO_CROSSFADE_DECISION',JSON.stringify({
              direction:cursor.status==='SCHEDULED'?'REVERSE':'FORWARD',
              eligible,slotId:cursor.slot?.id||null,targetId:prewarmed?.assetId||null,
              prepared:!!prewarmed,
              authority:cursor.status==='SCHEDULED'?!!reverseMixAuthorityAt:
                !!prewarmed?.sourceAuthorityConfirmedAt,
              pcmLeftMs:Math.round(audioLeft),boundaryLeftMs:Math.round(timeLeft),
              driftMs:Math.round(audioLeft-timeLeft),
              scheduledBoundaryMs:boundary,
              trackInitialRemainingMs:Math.round(remaining),
              emittedMs:Math.round(emittedBytes/PCM_BYTES_PER_MS),
              windowReached:emittedBytes>=Math.max(0,fadeTotalBytes-LIVE_SOURCE_OVERLAP_BYTES),
              reverseAuthorityReservationMatches:cursor.status==='SCHEDULED'
                ?reverseMixAuthorityReservation===reverseReservedTarget:null,
              reverseAuthorityAgeMs:cursor.status==='SCHEDULED'&&reverseMixAuthorityAt
                ?Date.now()-reverseMixAuthorityAt:null,
              pcmWindowStartMs:(fadeTotalBytes-LIVE_SOURCE_OVERLAP_BYTES)/PCM_BYTES_PER_MS,
              bytesUntilWindow:Math.max(0,fadeTotalBytes-LIVE_SOURCE_OVERLAP_BYTES-emittedBytes),
              incomingChunkBytes:output.length,
              sourceIdentityOk:cursor.status==='SCHEDULED'
                ?reverseReservedTarget?.slotId===cursor.slot?.id&&preparedSlot?.assetId===reverseReservedTarget?.assetId
                :preparedSlot?.scheduledSlotStartMs===boundary&&!!preparedSlot?.scheduledSlotId,
              preparedSeekOk:cursor.status==='SCHEDULED'
                ?preparedSlot?.seekMs===reverseReservedTarget?.seekMs&&!preparedSlot?.iterator
                :!preparedSlot?.iterator,
              decoderAlive:!!preparedSlot&&!preparedSlot.child.killed,

              at:new Date().toISOString()}));
          }
          const boundaryFade=scheduledBoundaryFadePolicy({
            enabled:scheduledBoundaryFadeEnabled,status:cursor.status,
            isLastTrack:isLastScheduledTrack,usableBlend,
            crossfadeEligible:eligible,remainingMs:remaining
          });
          const safeFadeOut=fadeOut||boundaryFade.fadeOut;
          const safeFadeMs=boundaryFade.fadeOut?boundaryFade.fadeMs:DEFAULT_SOURCE_FADE_MS;
          const windowStart=Math.max(0,fadeTotalBytes-LIVE_SOURCE_OVERLAP_BYTES);
          const hourBound=boundHourlyPcmChunk({
            chunkBytes:output.length,emittedBytes,
            cutAtBytes:hourlyCutAtBytes,fadeAtBytes:hourlyFadeAtBytes
          });
          const hourBytesLeft=hourBound.takeBytes;
          const plainBytes=Math.min(eligible?Math.min(output.length,Math.max(0,windowStart-emittedBytes)):output.length,hourBytesLeft);
          if(plainBytes){
            const plain=fadePcmChunk(output.subarray(0,plainBytes),{
              positionBytes:emittedBytes,totalBytes:fadeTotalBytes,
              fadeMs:safeFadeMs,fadeIn,fadeOut:safeFadeOut&&!eligible
            });
            const hourFaded=hourlyFadeAtBytes===null?plain:fadePcmChunk(plain,{
              positionBytes:Math.max(0,emittedBytes-hourlyFadeAtBytes),
              totalBytes:Math.max(4,hourlyCutAtBytes-hourlyFadeAtBytes),
              fadeMs:Math.max(1,(hourlyCutAtBytes-hourlyFadeAtBytes)/PCM_BYTES_PER_MS),
              fadeIn:false,fadeOut:true
            });
            if(!encoder.stdin.write(hourFaded))await new Promise(resolve=>encoder.stdin.once('drain',resolve));
            emittedBytes+=plain.length;
          }
          if(hourlyCutAtBytes!==null&&emittedBytes>=hourlyCutAtBytes){
            state.hourlySignal.lastFade={key:state.hourlySignal.pendingInterrupt?.key||null,
              source:cursor.status,trackId:asset.id,fadeBytes:hourlyCutAtBytes-hourlyFadeAtBytes,
              droppedDecoderBytes:hourBound.dropBytes,at:new Date().toISOString()};
            console.info('RADIO_HOURLY_PCM_BOUNDARY',JSON.stringify(state.hourlySignal.lastFade));
            hourlyInterrupt=true;child.kill('SIGTERM');break;
          }
          const tail=hourlyFadeAtBytes===null?output.subarray(plainBytes):Buffer.alloc(0);
          // Once all 72,000 frames have been mixed, later FFmpeg packets
          // must not be submitted to the closed overlap engine or routed as
          // a fallback from the already faded-out source.
          if(tail.length && liveMixSession?.engine.snapshot().phase==='COMPLETED'){
            state.liveSourceCrossfade.last={status:'POST_MIX_SOURCE_DISCARDED',
              direction:liveMixSession.direction,discardedBytes:tail.length,
              at:new Date().toISOString()};
          }else if(tail.length){
            if(eligible){
              try{
                if(!liveMixSession){
                  const engine=new RadioSourcePcmOverlap({
                    source:{id:asset.id,mode:cursor.status},
                    target:{id:preparedSlot.assetId,mode:reverseEligible?'AUTO_DJ':'SCHEDULED'},
                    overlapMs:LIVE_SOURCE_OVERLAP_MS,curve:'sCurve'
                  });
                  const ready=engine.start({sourceReady:true,targetReady:true,
                    slotAuthority:true,publicLive:publicLive.onAir});
                  if(!ready.ok)throw new Error(ready.reason);
                  liveMixSession={engine,iterator:preparedSlot.child.stdout[Symbol.asyncIterator](),
                    slotId:reverseEligible?cursor.slot.id:preparedSlot.scheduledSlotId,
                    assetId:preparedSlot.assetId,direction:reverseEligible?'REVERSE':'FORWARD'};
                  console.info('RADIO_CROSSFADE_MIX',JSON.stringify({status:'STARTED',direction:liveMixSession.direction,
                    fromId:asset.id,toId:preparedSlot.assetId,slotId:liveMixSession.slotId,
                    at:new Date().toISOString()}));
                }
                // FFmpeg packets do not end on an overlap boundary. Feed only
                // the remaining whole stereo frames to the overlap engine;
                // an oversize final packet must not be mistaken for mix failure.
                const framesLeft=LIVE_SOURCE_OVERLAP_MS*48-
                  liveMixSession.engine.snapshot().framesOut;
                if(framesLeft<=0)throw new Error('OVERLAP_ALREADY_COMPLETED');
                const overlapTail=tail.subarray(0,Math.min(tail.length,framesLeft*4));
                const incoming=await readPcmFrames(liveMixSession.iterator,overlapTail.length/4,{
                  deadlineMs:350,maxBufferedFrames:240000
                });
                if(publicLive.onAir||prewarmed!==preparedSlot)
                  throw new Error('SOURCE_AUTHORITY_CHANGED');
                const mixed=liveMixSession.engine.push(overlapTail,incoming);
                if(mixed.pcm.length!==overlapTail.length)throw new Error('MIXED_PCM_LENGTH_MISMATCH');
                if(!encoder.stdin.write(mixed.pcm))
                  await new Promise(resolve=>encoder.stdin.once('drain',resolve));
                emittedBytes+=mixed.pcm.length;
                if(liveMixSession.direction==='FORWARD'){
                  scheduledEntryOverlap={slotId:liveMixSession.slotId,
                    assetId:liveMixSession.assetId,
                    consumedFrames:liveMixSession.engine.snapshot().framesOut};
                }else if(reverseReservedTarget){
                  reverseReservedTarget={...reverseReservedTarget,
                    consumedFrames:liveMixSession.engine.snapshot().framesOut};
                }
                if(mixed.status==='COMPLETED'){
                  preparedSlot.iterator=liveMixSession.iterator;
                  preparedSlot.seekMs+=LIVE_SOURCE_OVERLAP_MS;
                  preparedSlot.durationMs-=LIVE_SOURCE_OVERLAP_MS;
                  if(liveMixSession.direction==='REVERSE'){
                    state.reverseHandover.mixed++;
                    state.reverseHandover.last={status:'MIXED',assetId:preparedSlot.assetId,
                      frames:liveMixSession.engine.snapshot().framesOut,at:new Date().toISOString()};
                  }
                  state.liveSourceCrossfade.completed++;
                  state.sourceHandover.mixed++;
                  console.info('RADIO_CROSSFADE_MIX',JSON.stringify({status:'COMPLETED',
                    direction:liveMixSession.direction,frames:liveMixSession.engine.snapshot().framesOut,
                    fromId:asset.id,toId:preparedSlot.assetId,at:new Date().toISOString()}));
                  state.liveSourceCrossfade.last={status:'MIXED',
                    direction:liveMixSession.direction,slotId:liveMixSession.slotId,
                    frames:liveMixSession.engine.snapshot().framesOut,
                    at:new Date().toISOString()};
                }
              }catch(error){
                liveMixDisabled=true;
                if(publicLive.onAir||stopping){child.kill('SIGTERM');break;}
                state.liveSourceCrossfade.fallbacks++;
                if(liveMixSession?.engine.snapshot().framesOut)
                  state.liveSourceCrossfade.partial++;
                state.liveSourceCrossfade.last={status:'FALLBACK',reason:error.message,
                  at:new Date().toISOString()};
                console.warn('RADIO_CROSSFADE_MIX',JSON.stringify({status:'FALLBACK',
                  direction:liveMixSession?.direction||null,reason:error.message,
                  at:new Date().toISOString()}));
                state.lastError='Source crossfade: '+error.message;
                // Missing target PCM: emit the outgoing frame only. Never
                // replay mixed bytes or restart the scheduled track at zero.
                const fallback=fadePcmChunk(tail,{positionBytes:emittedBytes,
                  totalBytes:fadeTotalBytes,fadeMs:DEFAULT_SOURCE_FADE_MS,
                  fadeIn:false,fadeOut});
                if(!encoder.stdin.write(fallback))
                  await new Promise(resolve=>encoder.stdin.once('drain',resolve));
                emittedBytes+=fallback.length;
                if(liveMixSession?.direction==='REVERSE'&&reverseReservedTarget?.consumedFrames){
                  // Never reset a partially aired AutoDJ intro to its cue-in.
                  // Retain the actual prepared decoder only if still usable.
                  preparedSlot.iterator=liveMixSession.iterator;
                  preparedSlot.seekMs=reverseReservedTarget.seekMs+
                    reverseReservedTarget.consumedFrames/48;
                  preparedSlot.durationMs=reverseReservedTarget.durationMs-
                    reverseReservedTarget.consumedFrames/48;
                }else if(prewarmed===preparedSlot)discardPrewarm();
              }
            }else{
              const normal=fadePcmChunk(tail,{positionBytes:emittedBytes,
                totalBytes:fadeTotalBytes,fadeMs:safeFadeMs,fadeIn,fadeOut:safeFadeOut});
              if(!encoder.stdin.write(normal))
                await new Promise(resolve=>encoder.stdin.once('drain',resolve));
              emittedBytes+=normal.length;
            }
          }
        }
        if(gated.truncated){
          truncatedAtBoundary=true;
          recordBoundary({source:'SCHEDULED',reason:'END_AT_PCM_TRUNCATED',slotId:cursor.slot.id,trackId:asset.id,
            droppedBytes:decoded.length-output.length});
          child.kill('SIGTERM');
          break;
        }
        if(!output.length)continue;
        // Start the next FFmpeg decoder while current PCM is still playing.
        // A bounded OS pipe supplies a warm initial PCM buffer; no second audio
        // source is connected to the station encoder until handoff.
        if(!warmRequested&&(cursor.status==='SCHEDULED'||(cursor.status==='AUTO_DJ'&&
           (!LIVE_SOURCE_CROSSFADE_ENABLED||!Number.isFinite(boundary))))&&
           (cursor.isJingle?musicQueueNextId:nextTrackId)&&!usableBlend&&
          remaining-emittedBytes/(48000*4)*1000<4500){
          warmRequested=true;
          void warmSuccessor({nextTrackId:cursor.isJingle?musicQueueNextId:nextTrackId,
            musicCount:cursor.isJingle?0:musicSinceJingle+1,scheduled:cursor.status==='SCHEDULED',
            currentTrackId:asset.id,expectedRemainingMs:remaining-emittedBytes/(48000*4)*1000});
        }
        if(LIVE_SOURCE_CROSSFADE_ENABLED&&gridCrossfadeEnabled&&!crossfadeAuthorityRequested&&
          cursor.status==='SCHEDULED'&&isLastScheduledTrack&&Number.isFinite(boundary)&&
          boundary-Date.now()<=4500&&boundary-Date.now()>1700&&
          prewarmed?.scheduledSlotStartMs===boundary){
          crossfadeAuthorityRequested=true;
          const candidate=prewarmed;
          void (async()=>{
            try{
              const slot=await prisma.radioScheduleSlot.findUnique({
                where:{id:candidate.scheduledSlotId},
                select:{startAt:true,endAt:true,playlist:{select:{status:true}}}
              });
              if(slot?.playlist?.status==='APPROVED'&&Date.parse(slot.startAt)===boundary&&
                Date.parse(slot.endAt)>boundary&&prewarmed===candidate)
                candidate.sourceAuthorityConfirmedAt=Date.now();
            }catch(error){state.lastError='Grid-to-grid authority: '+error.message;}
          })();
        }
        if(LIVE_SOURCE_CROSSFADE_ENABLED&&!crossfadeAuthorityRequested&&
          cursor.status==='AUTO_DJ'&&!cursor.isJingle&&Number.isFinite(boundary)&&
          boundary-Date.now()<=4500&&boundary-Date.now()>1700&&
          prewarmed?.scheduledSlotStartMs===boundary){
          crossfadeAuthorityRequested=true;
          const candidate=prewarmed;
          void (async()=>{
            try{
              const slot=await prisma.radioScheduleSlot.findUnique({
                where:{id:candidate.scheduledSlotId},
                select:{startAt:true,endAt:true,playlist:{select:{status:true}}}
              });
              if(slot?.playlist?.status==='APPROVED'&&Date.parse(slot.startAt)===boundary&&
                Date.parse(slot.endAt)>boundary&&prewarmed===candidate){
                candidate.sourceAuthorityConfirmedAt=Date.now();
              }
            }catch(error){state.lastError='Crossfade authority: '+error.message;}
          })();
        }
        if(!sourceClockPlanned&&cursor.status==='AUTO_DJ'&&!cursor.isJingle&&
          Number.isFinite(boundary)&&boundary-Date.now()<=5500&&boundary-Date.now()>0){
          sourceClockPlanned=true;
          const timing=planSourceHandover({
            fromMode:'AUTO_DJ',toMode:'SCHEDULED',nowMs:Date.now(),
            boundaryMs:boundary,overlapMs:1500,
            // This dry-run does not imply the new audio route is connected.
            sourceRemainingMs:Math.max(0,remaining-emittedBytes/PCM_BYTES_PER_MS),
            targetDurationMs:Infinity
          });
          state.sourceHandover.lastClockPlan={...timing,at:new Date().toISOString(),
            publicPcmMixed:false};
          if(timing.allowed)state.sourceHandover.clockPlanned++;
          else state.sourceHandover.clockRejected++;
        }
        // Reserve the actual next AutoDJ asset before the scheduled final
        // track exits. Freeze the candidate only for this slot and playlist.
        if(LIVE_SOURCE_CROSSFADE_ENABLED&&cursor.status==='SCHEDULED'&&
          !(gridCrossfadeEnabled&&prewarmed?.scheduledSlotStartMs===boundary)&&
          isLastScheduledTrack&&!reverseReservedTarget&&!reverseReserveInFlight&&
          boundary-Date.now()<12000&&boundary-Date.now()>2000){
          reverseReserveInFlight=true;
          void (async()=>{
            try{
              const settings=await readAutoDjSettings();
              if(!settings.enabled||!settings.playlistId){reversePrewarmBlocked('AUTO_DJ_DISABLED');return;}
              if(publicLive.onAir){reversePrewarmBlocked('PUBLIC_LIVE');return;}
              if(prewarmed||prewarming){reversePrewarmBlocked('PREWARM_BUSY',{preparedAssetId:prewarmed?.assetId||null});return;}
              const rotationSettings=await readRotation();
              const playlist=await prisma.radioPlaylist.findUnique({
                where:{id:settings.playlistId},
                include:{items:{orderBy:{position:'asc'},include:{asset:true}}}
              });
              const approved=cueAssets(selectAutoDjAssets(playlist)
                .filter(candidate=>!failedAutoDjAssets.has(candidate.id)),await readCues());
              const nowMs=Date.now();
              let selected=null;
              if(rotationSettings.enabled){
                const plan=rotationPlan(approved,rotationSettings,nowMs);
                const music=plan?.items||approved;
                const history=await readPlayoutHistory();
                const ordered=prioritizeUnplayed(music,history,rotationSettings.cooldownMinutes,nowMs);
                const artistGap=rotationSettings.artistGap||0;
                const artistRecent=recentlyAiredArtists.slice(-artistGap);
                if(rotationSettings.strictCooldown&&rotationSettings.cooldownMinutes>0){
                  const avoided=new Set(artistRecent.map(name=>name.toLocaleLowerCase('ru-RU')));
                  const distinct=ordered.filter(item=>!avoided.has(
                    id3Artist(item).normalize('NFKC').trim().replace(/\\s+/g,' ').toLocaleLowerCase('ru-RU'))
                    ||!id3Artist(item).trim());
                  const eligible=chooseQueuedTrack(distinct,history,rotationSettings.cooldownMinutes,nowMs)
                    ||chooseQueuedTrack(ordered,history,rotationSettings.cooldownMinutes,nowMs);
                  selected=eligible||selectExhaustionFallback(
                    distinct.length?distinct:ordered,history,nowMs,rotationSettings.allowCooldownFallback);
                }else{
                  selected=fairNextTrack(ordered,history,artistRecent,artistGap,nowMs);
                }
              }else{
                selected=approved.find(a=>a.playDurationMs>=2500);
              }
              if(selected?.playDurationMs<2500)selected=null;
              if(!selected){reversePrewarmBlocked('NO_ELIGIBLE_ASSET');return;}
              if(publicLive.onAir||state.trackId!==asset.id){reversePrewarmBlocked('SOURCE_CHANGED');return;}
              const reservation=reserveReverseTarget({
                asset:selected,playlistId:settings.playlistId,slotId:cursor.slot.id,
                slotEndMs:boundary,seekMs:selected.cue.inMs,
                durationMs:selected.playDurationMs,nowMs:Date.now()
              });
              if(!reservation){reversePrewarmBlocked('RESERVATION_REJECTED');return;}
              if(reservation&&!reverseReservedTarget){
                reverseReservedTarget=reservation;
                // Never reuse authorization from the preceding scheduled show.
                reverseMixAuthorityAt=null;
                reverseMixAuthorityReservation=null;
                state.reverseHandover.lastAuthorityReason=null;
                // Capture the verified delayed-show clock while its cursor is active.
                // It can change/clear before asynchronous authorization runs.
                reverseReservedShift=delayedShiftProof?.slotId===reservation.slotId&&
                  delayedShiftProof.actualEndMs===reservation.slotEndMs
                  ?{...delayedShiftProof}:null;
                if(!prewarmed&&!prewarming){
                  void warmSuccessor({nextTrackId:reservation.assetId,musicCount:0,
                    currentTrackId:asset.id,reverse:true});
                }
                console.info('RADIO_REVERSE_SHIFT_SNAPSHOT',JSON.stringify({
                  slotId:reservation.slotId,reservedEndMs:reservation.slotEndMs,
                  shift:reverseReservedShift,
                  activeShiftId:delayedScheduledSlot?.id||null,
                  activeShiftOriginalEndMs:delayedScheduledSlot?.originalEndMs??null,
                  activeShiftActualEndMs:delayedScheduledSlot?.actualEndMs??null,
                  at:new Date().toISOString()}));
                state.reverseTargetReservation.reserved++;
                state.reverseTargetReservation.last={status:'RESERVED',assetId:reservation.assetId,
                  slotId:reservation.slotId,at:new Date().toISOString()};
                console.info('RADIO_REVERSE_PREWARM',JSON.stringify(state.reverseTargetReservation.last));
              }
            }catch(error){state.lastError='Reverse reservation: '+error.message;
              reversePrewarmBlocked('LOOKUP_FAILED',{message:error.message});}
            finally{reverseReserveInFlight=false;}
          })();
        }
        if(LIVE_SOURCE_CROSSFADE_ENABLED&&cursor.status==='SCHEDULED'&&
          isLastScheduledTrack&&reverseReservedTarget&&prewarmed?.assetId===reverseReservedTarget.assetId&&
          !reverseMixAuthorityAt&&!reverseAuthorityInFlight&&boundary-Date.now()<=4500&&boundary-Date.now()>1700){
          reverseAuthorityInFlight=true;
          const reservation=reverseReservedTarget;
          void (async()=>{
            try{
              const [slot,settings,active]=await Promise.all([
                prisma.radioScheduleSlot.findUnique({
                  where:{id:reservation.slotId},
                  select:{endAt:true,playlist:{select:{status:true}}}}),
                readAutoDjSettings(),
                prisma.radioScheduleSlot.findFirst({
                  where:{startAt:{lte:new Date(boundary)},endAt:{gt:new Date(boundary)},
                    playlist:{status:'APPROVED'}},
                  select:{id:true},orderBy:{startAt:'asc'}
                })
              ]);
              // A finish-current-track handoff may shift the effective show end.
              // Accept only the exact internally recorded shift for this slot;
              // an arbitrary database/end-time mismatch remains fail-closed.
              const dbEndMs=slot?.endAt instanceof Date?slot.endAt.getTime():NaN;
              const verifiedDelayedEnd=!!reverseReservedShift&&
                reverseReservedTarget===reservation&&
                reverseReservedShift.slotId===reservation.slotId&&
                reverseReservedShift.originalEndMs===dbEndMs&&
                reverseReservedShift.actualEndMs===reservation.slotEndMs;
              const endMatches=dbEndMs===reservation.slotEndMs||verifiedDelayedEnd;
              const reason=slot?.playlist?.status!=='APPROVED'?'SLOT_NOT_APPROVED':
                !endMatches?'SLOT_END_CHANGED':
                !settings.enabled?'AUTO_DJ_DISABLED':
                settings.playlistId!==reservation.playlistId?'PLAYLIST_CHANGED':
                active?'NEXT_SCHEDULE_ACTIVE':
                publicLive.onAir?'PUBLIC_LIVE':
                reverseReservedTarget!==reservation?'RESERVATION_CHANGED':null;
              if(!reason){
                reverseMixAuthorityAt=Date.now();
                reverseMixAuthorityReservation=reservation;
                if(verifiedDelayedEnd)console.info('RADIO_REVERSE_AUTHORITY',JSON.stringify({
                  status:'DELAYED_SLOT_CONFIRMED',slotId:reservation.slotId,
                  originalEndMs:dbEndMs,actualEndMs:reservation.slotEndMs,
                  at:new Date().toISOString()}));
              }
              if(!reason||state.reverseHandover.lastAuthorityReason!==reason)
                console.info('RADIO_REVERSE_AUTHORITY',JSON.stringify({
                  status:reason?'BLOCKED':'CONFIRMED',reason,
                  slotId:reservation.slotId,targetId:reservation.assetId,at:new Date().toISOString()}));
              if(reason==='SLOT_END_CHANGED'){
                if(state.reverseHandover.lastEndMismatchKey!==reservation.slotId+':'+dbEndMs)
                  console.warn('RADIO_SLOT_END_MISMATCH',JSON.stringify({
                  slotId:reservation.slotId,
                  reservedEndMs:reservation.slotEndMs,
                  databaseEndMs:Number.isFinite(dbEndMs)?dbEndMs:null,
                  differenceMs:Number.isFinite(dbEndMs)?dbEndMs-reservation.slotEndMs:null,
                  shift:reverseReservedShift,
                  reservationStillActive:reverseReservedTarget===reservation,
                  activeShiftId:delayedScheduledSlot?.id||null,
                  at:new Date().toISOString()}));
                state.reverseHandover.lastEndMismatchKey=reservation.slotId+':'+dbEndMs;
              }
              state.reverseHandover.lastAuthorityReason=reason;
            }catch(error){state.lastError='Reverse crossfade authority: '+error.message;
              console.warn('RADIO_REVERSE_AUTHORITY',JSON.stringify({status:'ERROR',reason:error.message,at:new Date().toISOString()}));}
            finally{reverseAuthorityInFlight=false;}
          })();
        }
        // Reverse transition admission is observational until the AutoDJ
        // candidate can be reserved without changing playlist rotation.
        if(!reverseClockPlanned&&cursor.status==='SCHEDULED'&&isLastScheduledTrack&&
          Number.isFinite(boundary)&&boundary-Date.now()<=5500&&boundary-Date.now()>0){
          reverseClockPlanned=true;
          const candidate=prewarmed;
          const plan=planReverseHandover({
            nowMs:Date.now(),slotEndMs:boundary,
            remainingMs:Math.max(0,remaining-emittedBytes/PCM_BYTES_PER_MS),
            lastScheduledTrack:true,autoDjEnabled:state.autoDjEnabled,
            target:candidate&&!candidate.scheduledSlotId?
              {id:candidate.assetId,seekMs:candidate.seekMs}:null,
            prepared:candidate,publicLive:publicLive.onAir
          });
          state.reverseHandover.attempts++;
          if(plan.allowed)state.reverseHandover.eligible++;
          else state.reverseHandover.blocked++;
          state.reverseHandover.last={...plan,at:new Date().toISOString(),mixed:false};
        }
        if(!scheduledPrewarmRequested&&gridCrossfadeEnabled&&LIVE_SOURCE_CROSSFADE_ENABLED&&
          cursor.status==='SCHEDULED'&&isLastScheduledTrack&&!usableBlend&&!publicLive.onAir&&
          Number.isFinite(boundary)&&boundary-Date.now()<12000&&boundary-Date.now()>2500){
          scheduledPrewarmRequested=true;
          void (async()=>{
            try{
              const next=await prisma.radioScheduleSlot.findFirst({
                where:{startAt:{gte:new Date(boundary-500),lte:new Date(boundary+500)},
                  playlist:{status:'APPROVED'}},
                include:{playlist:{include:{items:{orderBy:{position:'asc'},take:1,include:{asset:true}}}}},
                orderBy:{startAt:'asc'}
              });
              const first=next?.playlist?.items?.[0]?.asset;
              if(first?.id&&Date.parse(next.startAt)===boundary&&!prewarmed&&!prewarming){
                console.info('RADIO_GRID_PREWARM',JSON.stringify({status:'REQUESTED',
                  fromSlotId:cursor.slot.id,toSlotId:next.id,assetId:first.id}));
                void warmSuccessor({nextTrackId:first.id,musicCount:0,currentTrackId:asset.id,
                  scheduled:true,scheduledSlotId:next.id,scheduledSlotStartMs:boundary});
              }else scheduledPrewarmRequested=false;
            }catch(error){scheduledPrewarmRequested=false;state.lastError='Grid prewarm: '+error.message;}
          })();
        }
        if(!scheduledPrewarmRequested&&cursor.status==='AUTO_DJ'&&!cursor.isJingle&&
          !pendingScheduledHandover&&!publicLive.onAir&&Number.isFinite(boundary)&&
          boundary-Date.now()<12000&&boundary-Date.now()>2500){
          scheduledPrewarmRequested=true;
          void (async()=>{
           try{
            const nextSlot=await prisma.radioScheduleSlot.findFirst({
              where:{startAt:{gte:new Date(boundary-500),lte:new Date(boundary+500)},
                playlist:{status:'APPROVED'}},
              include:{playlist:{include:{items:{orderBy:{position:'asc'},take:1,include:{asset:true}}}}},
              orderBy:{startAt:'asc'}
            });
            const first=nextSlot?.playlist?.items?.[0]?.asset;
            if(first?.id&&!prewarmed&&Date.parse(nextSlot.startAt)===boundary){
              console.info('RADIO_SCHEDULED_PREWARM',JSON.stringify({
                status:'REQUESTED',slotId:nextSlot.id,trackId:first.id,
                boundaryInMs:boundary-Date.now(),at:new Date().toISOString()}));
              void warmSuccessor({nextTrackId:first.id,musicCount:0,currentTrackId:asset.id,scheduled:true,
                scheduledSlotId:nextSlot.id,scheduledSlotStartMs:Date.parse(nextSlot.startAt)});
            }else{
              console.info('RADIO_SCHEDULED_PREWARM',JSON.stringify({
                status:'NOT_READY',reason:!nextSlot?'SLOT_NOT_FOUND':!first?'NO_FIRST_ASSET':
                  prewarmed?'DECODER_BUSY':'BOUNDARY_MISMATCH',
                boundaryInMs:boundary-Date.now(),at:new Date().toISOString()}));
              scheduledPrewarmRequested=false;
            }
           }catch(error){state.lastError='Scheduled prewarm lookup: '+error.message;}
          })();
        }
        if(stationClock){
          const delta=emittedBytes-stationClockObservedBytes;
          if(delta>0){stationClock.emit(delta);stationClockObservedBytes=emittedBytes;}
          if(!stationClockLogged&&boundary-Date.now()<2500&&boundary-Date.now()>0){
            stationClockLogged=true;
            const target=prewarmed;
            const authority=cursor.status==='SCHEDULED'?
              !!reverseMixAuthorityAt:!!target?.sourceAuthorityConfirmedAt;
            const report=stationClock.decision(Date.now(),{
              sourceReady:true,targetReady:!!target&&!target.child.killed,
              authority,publicLive:publicLive.onAir});
            state.stationDualDeck.observations++;
            state.stationDualDeck.last={
              mode:'SHADOW_ONLY',source:cursor.status,sourceId:asset.id,
              targetId:target?.assetId||null,deckIdle:!stationDeck.active,
              reason:report.reason,ok:report.ok,
              driftMs:Math.round(report.driftMs),
              boundaryInMs:Math.round(report.boundaryInMs),
              emittedFrames:report.framesOut,at:new Date().toISOString()};
            console.info('RADIO_STATION_DUAL_DECK_SHADOW',
              JSON.stringify(state.stationDualDeck.last));
          }
        }
        if(state.playout?.trackId===asset.id){
          if(!state.playout.startedAt)state.playout.startedAt=Date.now();
          state.playout.emittedMs=Math.round(emittedBytes/(48000*4)*1000);
        }
      }
    } catch(e) {state.lastError=e.message;}
    if(usableBlend){
      const transition={source:cursor.status,fromId:asset.id,toId:usableBlend.nextId,
        requestedMs:usableBlend.overlapMs,emittedMs:Math.round(emittedBytes/PCM_BYTES_PER_MS),
        startedAt:new Date(crossfadeStartedAt).toISOString(),at:new Date().toISOString(),
        exitCode,completed:exitCode===0&&!truncatedAtBoundary};
      state.transitions.lastCrossfade=transition;
      if(transition.completed)state.transitions.crossfadeCompleted++;
      else state.transitions.crossfadeFailed++;
    }
    if(cursor.status==='SCHEDULED'){
      if(!hourlyInterrupt&&exitCode===0&&!truncatedAtBoundary){
        lastCompletedScheduledTrack={
          slotId:cursor.slot.id,playlistId:cursor.slot.playlistId,
          index:cursor.track?.index??-1,assetId:asset.id,at:Date.now()
        };
      }
      const key=cursor.slot.id+':'+asset.id+':'+(cursor.track?.index??0);
      for(const [old,expiry] of finishedScheduledTrackKeys)if(expiry<Date.now())finishedScheduledTrackKeys.delete(old);
      if(!finishedScheduledTrackKeys.has(key)){
        finishedScheduledTrackKeys.set(key,Date.parse(cursor.slot.endAt)+60000);
        if(!(state.lastBoundary?.slotId===cursor.slot.id && state.lastBoundary?.trackId===asset.id && state.lastBoundary?.reason==='END_AT_PCM_TRUNCATED')){
          recordBoundary({source:'SCHEDULED',reason:'TRACK_ENDED',slotId:cursor.slot.id,trackId:asset.id});
        }
      }
    }
    if(pcmStaging){
      pcmStaging.finish();
      state.pcmStaging.processedBytes+=pcmStaging.totalBytes;
      state.pcmStaging.droppedTailBytes+=pcmStaging.droppedTailBytes;
    }
    if(hourlyTrackTimer)clearInterval(hourlyTrackTimer);
    if(watchdog)clearInterval(watchdog);
    if(activeSlotWatchdog)clearInterval(activeSlotWatchdog);
    // Flush natural ffmpeg exit before counting a completed track. Stream EOF
    // can arrive before the child 'close' event; without this the on-air
    // jingle interval counter would sometimes never advance.
    if(!ended&&!stopping&&!publicLive.onAir){
      await Promise.race([
        new Promise(resolve=>child.once('close',resolve)),
        new Promise(resolve=>setTimeout(resolve,350)),
      ]);
    }
    // Log only PCM that actually reached the persistent encoder, not planned selections.
    // The event measures generated playout, NOT acoustic proof at the listener.
    const generatedMs=emittedBytes/(48000*2*2)*1000;
    if(generatedMs>=1000){
      const events=playbackAttributions({track:{id:asset.id,name:asset.name},
        blend:usableBlend,generatedMs,startedAt:playbackStartedAt,
        mode:cursor.status,slotId:cursor.slot?.id||null});
      // A slow journal write must never create dead air at the next track boundary.
      void recordPlayoutEvents(events).catch(error=>{state.lastError='Playback journal: '+error.message;});
    }
    if(generatedMs>=250&&['AUTO_DJ','SCHEDULED'].includes(cursor.status))
      lastDecodedSource={id:asset.id,mode:cursor.status,emittedMs:generatedMs,at:Date.now()};
    if(hourlyInterrupt&&cursor.status==='SCHEDULED'){
      lastCompletedScheduledTrack={
        slotId:cursor.slot.id,playlistId:cursor.slot.playlistId,
        index:cursor.track.index,assetId:asset.id,at:Date.now()
      };
      state.mode='SCHEDULED';
      console.info('RADIO_HOURLY_SCHEDULED_INTERRUPT_COMMITTED',JSON.stringify({
        slotId:cursor.slot.id,trackId:asset.id,index:cursor.track.index,
        nextTrackId,at:new Date().toISOString()
      }));
    }
    if(hourlyInterrupt){
      console.info('RADIO_HOURLY_INTERRUPT_COMMITTED',JSON.stringify({
        assetId:asset.id,nextTrackId:nextTrackId||null,emittedMs:Math.round(generatedMs),
        key:state.hourlySignal.pendingInterrupt?.key||null
      }));
      // Mark the outgoing song as consumed; never replay its tail after the announcement.
      if(nextTrackId)musicQueueNextId=nextTrackId;
      musicSinceJingle=0;
      discardPrewarm();
    }
    if(cursor.status==='AUTO_DJ' && !cursor.isJingle && generatedMs>=1000){
      lastAutoDjTrackId=asset.id;
      recentlyAiredArtists.push(id3Artist(asset));
      if(recentlyAiredArtists.length>12)recentlyAiredArtists=recentlyAiredArtists.slice(-12);
    }
    if(cursor.status==='SCHEDULED' && isLastScheduledTrack && exitCode===0 && !truncatedAtBoundary && generatedMs>=1000){
      finishedScheduledSlot={id:cursor.slot.id,endAtMs:Date.parse(cursor.slot.endAt)};
      resumeAutoDjAfterShow=true;
      recordBoundary({source:'SCHEDULED',reason:'FINAL_TRACK_FINISHED',slotId:cursor.slot.id,trackId:asset.id});
    }
    if(cursor.isJingle){
      jinglePending=false;
      if(generatedMs>=1000&&exitCode===0){jinglesPlayed++;musicSinceJingle=0;}
    } else if(cursor.status==='AUTO_DJ'&&!hourlyInterrupt&&generatedMs>=1000&&exitCode===0){
      musicSinceJingle++;
      // Commit the next queue position only for completed songs, never for jingles.
      if(nextTrackId)musicQueueNextId=nextTrackId;
    }
    state.jingles={enabled:JINGLE_PLAYOUT_ENABLED,played:jinglesPlayed,musicSinceJingle};
    if(!ended) child.kill('SIGTERM');
    if(decoder===child) decoder=null;
    if(state.playout?.trackId===asset.id)state.playout=null;
    // A short song can end between the 3-second schedule watchdog polls.
    // Recover any scheduled show that started during this AutoDJ track, even
    // when its original wall-clock end has already passed. Otherwise current()
    // would seek into the middle of the show's playlist and skip early tracks.
    if(cursor.status==='AUTO_DJ' && !cursor.isJingle && !pendingScheduledHandover &&
       !stopping && !publicLive.onAir){
      try{
        const settings=await readAutoDjSettings();
        if(settings.finishTrackBeforeSchedule){
          const now=new Date();
          const missed=await prisma.radioScheduleSlot.findFirst({
            where:{startAt:{gt:new Date(playedStart),lte:now},
              playlist:{status:'APPROVED'}},
            select:{id:true,startAt:true,endAt:true},
            orderBy:{startAt:'asc'}
          });
          if(missed){
            pendingScheduledHandover={id:missed.id,
              originalStartMs:missed.startAt.getTime(),
              originalEndMs:missed.endAt.getTime()};
          }
        }
      }catch(error){state.lastError='Scheduled handover recovery: '+error.message;}
    }
    if(cursor.status==='AUTO_DJ' && pendingScheduledHandover && !stopping && !publicLive.onAir){
      const h=pendingScheduledHandover;pendingScheduledHandover=null;
      // Honor explicit schedule changes made while the song was playing.
      const validHandover=await prisma.radioScheduleSlot.findUnique({where:{id:h.id},
        select:{startAt:true,endAt:true,playlist:{select:{status:true}}}});
      if(validHandover?.playlist?.status==='APPROVED' && validHandover.endAt.getTime()>h.originalStartMs){
      // Shift by the actual finish; keep each song and broadcast at time zero.
      const actualStartMs=Date.now();
      delayedScheduledSlot={id:h.id,originalStartMs:h.originalStartMs,
        originalEndMs:h.originalEndMs,actualStartMs,
        actualEndMs:actualStartMs+(h.originalEndMs-h.originalStartMs)};
      resumeAutoDjAfterShow=true;
      recordBoundary({source:'AUTO_DJ',reason:'FINISHED_BEFORE_SCHEDULE',slotId:h.id,
        delayedByMs:Math.max(0,delayedScheduledSlot.actualStartMs-h.originalStartMs)});
      }
    }
    if(cursor.status==='AUTO_DJ' && exitCode!==null && exitCode!==0 && !child.killed)
      failedAutoDjAssets.set(asset.id,Date.now()+300000);
  }
}

const server=http.createServer((req,res)=>{
  if(!authorized(req)) {res.writeHead(403).end();return;}
  if(req.url==='/live-pcm/session' && req.method==='POST'){
    if(!LIVE_PCM_INTAKE_ENABLED){res.writeHead(404).end();return;}
    const owner=String(req.headers['x-radio-session-owner']||'').trim();
    try{const token=liveSessions.start(owner);switchShadow.cancel('SESSION_REPLACED');privatePreview.reset();privateLive.reset();isolatedMix.reset();liveIntake.reset();gatewayClock.reset();publicLive.stop('SESSION_REPLACED');if(TIMED_PCM_SHADOW_ENABLED)timedShadow.reset();if(PCM_MIX_LAB_ENABLED){pcmMixLab.reset();soakTelemetry.reset();}
      res.writeHead(201,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(JSON.stringify({sessionToken:token,connectedToEncoder:false}));
    }catch(error){res.writeHead(error instanceof TypeError?400:409).end();}return;
  }
  if(req.url==='/live-pcm/session' && req.method==='DELETE'){
    if(!LIVE_PCM_INTAKE_ENABLED){res.writeHead(404).end();return;}
    if(!liveSessions.stop(req.headers['x-radio-session-token'])){res.writeHead(403).end();return;}
    publicLive.stop('SESSION_CLOSED');privatePreview.reset();liveIntake.reset();gatewayClock.reset();res.writeHead(204).end();return;
  }
  if(req.url==='/live-pcm/on-air' && req.method==='POST'){
    if(!PUBLIC_LIVE_ENABLED){res.writeHead(404).end();return;}
    const token=req.headers['x-radio-session-token'];
    if(!liveSessions.valid(token)){res.writeHead(403).end();return;}
    const result=publicLive.start(token);
    if(result.ok)stopDecoder();
    res.writeHead(result.ok?200:409,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({...result,live:publicLive.snapshot()}));return;
  }
  if(req.url==='/live-pcm/on-air' && req.method==='DELETE'){
    const token=req.headers['x-radio-session-token'];
    if(!liveSessions.valid(token)){res.writeHead(403).end();return;}
    publicLive.stop('PRESENTER_ENDED');
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({ok:true,live:publicLive.snapshot()}));return;
  }
  if(req.url==='/live-pcm/status' && req.method==='GET'){
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({enabled:LIVE_PCM_INTAKE_ENABLED,connectedToEncoder:publicLive.onAir,publicLiveEnabled:PUBLIC_LIVE_ENABLED,publicLive:publicLive.snapshot(),...liveIntake.snapshot(),session:liveSessions.snapshot(),gatewayClock:gatewayClock.snapshot(),timedShadow:shadowStatus(),switchShadow:switchShadow.snapshot(),pcmMixLab:{enabled:PCM_MIX_LAB_ENABLED,...pcmMixLab.snapshot()},pcmSoak:{enabled:PCM_MIX_LAB_ENABLED,...soakTelemetry.snapshot()}}));
    return;
  }
  if(req.url==='/live-pcm/private-preview' && req.method==='GET'){
    if(!PRIVATE_PREVIEW_ENABLED||!liveSessions.snapshot().active){res.writeHead(404).end();return;}
    const wav=privatePreview.exportWav();
    if(!wav){res.writeHead(409).end();return;}
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff'});
    res.end(JSON.stringify({wavBase64:wav.toString('base64'),
      durationMs:privatePreview.snapshot().durationMs,
      connectedToEncoder:false,changeApplied:false}));return;
  }
  if(req.url?.startsWith('/live-pcm/private-mix?')&&req.method==='GET'){
    if(!ISOLATED_MIX_ENABLED||!liveSessions.snapshot().active){res.writeHead(404).end();return;}
    try{
      const raw=new URL(req.url,'http://localhost').searchParams.get('after');
      if(raw===null||!/^(-1|[0-9]{1,12})$/.test(raw)){res.writeHead(400).end();return;}
      const reply=isolatedMix.read({after:raw==='-1'?null:Number(raw),max:8});
      res.writeHead(reply.ok?200:409,{'Content-Type':'application/json','Cache-Control':'private, no-store'});
      res.end(JSON.stringify(reply));return;
    }catch{res.writeHead(400).end();return;}
  }
  if(req.url?.startsWith('/live-pcm/private-live?')&&req.method==='GET'){
    if(!PRIVATE_LIVE_ENABLED||!liveSessions.snapshot().active){res.writeHead(404).end();return;}
    try{
      const parsed=new URL(req.url,'http://localhost');
      const raw=parsed.searchParams.get('after');
      if(raw===null||!/^(-1|[0-9]{1,12})$/.test(raw)){res.writeHead(400).end();return;}
      const after=raw==='-1'?null:Number(raw);
      const reply=privateLive.read({after,max:8});
      res.writeHead(reply.ok?200:409,{'Content-Type':'application/json','Cache-Control':'private, no-store',
        'X-Content-Type-Options':'nosniff'});
      res.end(JSON.stringify(reply));return;
    }catch{res.writeHead(400).end();return;}
  }
  if(req.url==='/live-pcm/ingest' && req.method==='POST'){
    if(!LIVE_PCM_INTAKE_ENABLED){res.writeHead(404).end();return;}
    const sessionToken=req.headers['x-radio-session-token'];
    if(!liveSessions.valid(sessionToken)){res.writeHead(403).end();return;}
    const type=req.headers['content-type'];
    const size=Number(req.headers['content-length']);
    if(type!=='application/octet-stream'||!Number.isSafeInteger(size)||size<4||size>19200||size%4){
      res.writeHead(413).end();return;
    }
    const chunks=[];let received=0;
    req.on('data',buf=>{
      received+=buf.length;
      if(received>size){req.destroy();return;}
      chunks.push(buf);
    });
    req.on('end',()=>{
      if(received!==size){res.writeHead(400).end();return;}
      if(!liveSessions.valid(sessionToken)){res.writeHead(403).end();return;}
      try{
        const frameIndex=Number(req.headers['x-radio-pcm-frame-index']);
        if(!Number.isSafeInteger(frameIndex)||frameIndex<0||!req.headers['x-radio-pcm-frame-index'])throw new TypeError('Missing frame index');
        const pcm=Buffer.concat(chunks);
        gatewayClock.validate({pcm,frameIndex});
        const result=liveIntake.accept(pcm);
        if(PUBLIC_LIVE_ENABLED)publicLive.ingest(pcm,sessionToken,Date.now());
        if(PRIVATE_PREVIEW_ENABLED)privatePreview.accept(pcm,Date.now());
        if(PRIVATE_LIVE_ENABLED)privateLive.push(pcm,Date.now());
        if(ISOLATED_MIX_ENABLED)isolatedMix.accept(pcm,Date.now());
        if(TIMED_PCM_SHADOW_ENABLED){
          const receivedAt=Date.now();
          const staged=timedShadow.push({pcm,frameIndex},receivedAt);
          if(PCM_MIX_LAB_ENABLED){
            const lab=pcmMixLab.push({pcm,frameIndex},receivedAt);
            soakTelemetry.receive(lab,pcmMixLab.snapshot(receivedAt).bufferedMs);
            if(!lab.ok)state.pcmMixLabLastError=lab.reason;
          }
          // Shadow failure never alters legacy intake/output: diagnostics only.
          if(!staged.ok)state.timedPcmShadowLastError=staged.reason;
        }
        liveSessions.touch(sessionToken,received);
        state.livePcmIntake={enabled:true,connectedToEncoder:false,...liveIntake.snapshot()};
        res.writeHead(202,{'Content-Type':'application/json','Cache-Control':'no-store'});
        res.end(JSON.stringify({accepted:true,...result,connectedToEncoder:false}));
      }catch{res.writeHead(400).end();}
    });
    return;
  }
  if(req.url==='/health') {
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({...state,loudness:loudnessMeter.snapshot(),connected:listeners.size,emergencySimulation:emergencyDryRun.snapshot()}));return;
  }
  if(req.url!=='/stream') {res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':'audio/mpeg','Cache-Control':'private, no-store, no-transform',
    'X-Content-Type-Options':'nosniff','Connection':'keep-alive'});
  listeners.add(res);res.on('close',()=>listeners.delete(res));
});
server.listen(port,'127.0.0.1',()=>console.log('Radio playout worker on loopback',port));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{
  stopping=true;stopDecoder();server.close();
  for(const res of listeners) res.end();
  encoder?.stdin.end();setTimeout(()=>process.exit(0),500).unref();
});
run().catch(e=>{console.error(e);process.exit(1);});
