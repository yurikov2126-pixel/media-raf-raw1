#!/usr/bin/env node
/**
 * Opt-in station playout worker: one persistent MP3 encoder, shared live output.
 * Binds loopback only; authenticated Express API proxy is the sole public entry.
 * This stage mixes scheduled tracks and silence, NOT browser microphone audio.
 */
import 'dotenv/config';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { resolveRadioCursor } from '../src/lib/radioTimeline.js';
import { readAutoDjSettings, selectAutoDjAssets, autoDjCursor } from '../src/lib/radioAutoDj.js';
import { readAudioProcessing, audioProcessingFilter } from '../src/lib/radioAudioProcessing.js';
import { readCues, cueAssets, cueCursor } from '../src/lib/radioAudioCue.js';
import { crossfadePlan } from '../src/lib/radioCrossfade.js';
import { readRotation, rotationPlan, prioritizeUnplayed } from '../src/lib/radioRotation.js';
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
import { shouldInsertJingle, chooseJingleAsset } from '../src/lib/radioJingleRuntime.js';

const port = Number(process.env.RADIO_PLAYOUT_PORT || 4105);
const secret = process.env.RADIO_PLAYOUT_SECRET || '';
if (process.env.RADIO_PLAYOUT_ENABLED !== 'true' || secret.length < 32) {
  throw new Error('Set RADIO_PLAYOUT_ENABLED=true and a shared RADIO_PLAYOUT_SECRET of at least 32 characters');
}
const ffmpeg = process.env.RADIO_FFMPEG_PATH || 'ffmpeg';
const assetsRoot = path.resolve(process.env.RADIO_ASSET_DIR || 'private/radio-audio');
const listeners = new Set();
const state = { audioProcessing:{enabled:false}, version:'dsp-v1', mode:'STARTING',trackId:null,slotId:null,connected:0,startedAt:new Date().toISOString(),lastError:null,frames:0, autoDjEnabled:false };
let decoder = null;
let encoder = null;
let stopping = false;
const PCM_STAGING_ENABLED=process.env.RADIO_PCM_STAGING_ENABLED==='true';
state.pcmStaging={enabled:PCM_STAGING_ENABLED,frameBytes:4,droppedTailBytes:0,processedBytes:0};
const failedAutoDjAssets = new Map();
let frozenRotation=null;
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
const JINGLE_PLAYOUT_ENABLED=process.env.RADIO_JINGLE_PLAYOUT_ENABLED==='true';
let musicSinceJingle=0,jinglesPlayed=0,jinglePending=false;
state.jingles={enabled:JINGLE_PLAYOUT_ENABLED,played:0,musicSinceJingle:0};

function authorized(req) {
  const provided=req.headers['x-radio-worker-secret'];
  if(typeof provided!=='string') return false;
  const a=Buffer.from(provided), b=Buffer.from(secret);
  return a.length===b.length && timingSafeEqual(a,b);
}
function startEncoder() {
  encoder=spawn(ffmpeg,['-hide_banner','-loglevel','error','-nostdin',
    '-f','s16le','-ar','48000','-ac','2','-i','pipe:0',
    '-c:a','libmp3lame','-b:a','128k','-ar','48000','-f','mp3','-write_xing','0','pipe:1'],
    {stdio:['pipe','pipe','pipe']});
  encoder.stdout.on('data',data=>{
    state.frames+=1;
    for(const res of listeners) {
      if(!res.write(data)) {
        // Slow clients must not stall the station clock.
        listeners.delete(res); res.destroy();
      }
    }
  });
  encoder.stderr.on('data',buf=>{state.lastError=buf.toString().slice(-500);});
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
  const cursor=resolveRadioCursor(slots,nowMs);
  const scheduled=cursor.track?slots[0].playlist.items[cursor.track.index].asset:null;
  if(scheduled || cursor.slot) return {cursor,asset:scheduled};
  const settings=await readAutoDjSettings();
  state.autoDjEnabled=settings.enabled;
  if(!settings.enabled||!settings.playlistId)return {cursor,asset:null};
  const playlist=await prisma.radioPlaylist.findUnique({
    where:{id:settings.playlistId},
    include:{items:{orderBy:{position:'asc'},include:{asset:true}}}
  });
  for(const [id,expires] of failedAutoDjAssets)if(expires<=nowMs)failedAutoDjAssets.delete(id);
  const catalog=cueAssets(selectAutoDjAssets(playlist).filter(asset=>!failedAutoDjAssets.has(asset.id)),await readCues());
  if(!catalog.length)return {cursor,asset:null};
  const rotationSettings=await readRotation();
  const candidate=rotationPlan(catalog,rotationSettings,nowMs);
  // Keep the plan stable for this daypart, including its crossfade boundaries.
  // Changes in the history must not move the station cursor mid-song.
  const key=candidate?[candidate.anchorMs,candidate.endMs,rotationSettings.cooldownMinutes,
    catalog.map(a=>a.id+':'+a.playDurationMs).join(',')].join('|'):null;
  if(key!==frozenRotation?.key){
    frozenRotation=null;
    if(candidate){
      const history=rotationSettings.cooldownMinutes?await readPlayoutHistory():[];
      const items=prioritizeUnplayed(candidate.items,history,rotationSettings.cooldownMinutes,nowMs);
      frozenRotation={key,plan:{...candidate,items}};
    }
  }
  const rotation=frozenRotation?.plan||null;
  const music=rotation?.items||catalog;
  const clock=rotation?nowMs-rotation.anchorMs:nowMs;
  // Strict mode advances only after a decoder finishes. Nothing in the
  // generated playback history changes the selection of an already playing track.
  if(rotation && rotationSettings.strictCooldown && rotationSettings.cooldownMinutes>0){
    const history=await readPlayoutHistory();
    const eligible=chooseQueuedTrack(music,history,rotationSettings.cooldownMinutes,nowMs);
    const selected=eligible||selectExhaustionFallback(music,history,nowMs,rotationSettings.allowCooldownFallback);
    state.cooldownException=!!selected&&!eligible;
    const next=await prisma.radioScheduleSlot.findFirst({
      where:{startAt:{gt:now},playlist:{status:'APPROVED'}},
      select:{startAt:true},orderBy:{startAt:'asc'}
    });
    const until=Math.min(next?next.startAt.getTime():Infinity,rotation.endMs);
    if(!selected || until-nowMs<150){
      state.queueStatus=selected?'BOUNDARY':'COOLDOWN_WAIT';
      return {cursor,asset:null};
    }
    // Jingles are supported only in strict event queue, never the timeline cursor.
    // Both the saved configuration AND a separate Worker opt-in are required.
    if(JINGLE_PLAYOUT_ENABLED){
      const jingles=await readJingles();
      if(shouldInsertJingle({settings:jingles,daypart:rotation.daypart,
        completedMusic:musicSinceJingle,untilMs:until,nowMs})&&!jinglePending){
        const candidates=await prisma.radioAsset.findMany({where:{id:{in:jingles.assetIds}}});
        const jingle=chooseJingleAsset(jingles,candidates,jinglesPlayed);
        if(jingle&&until-nowMs>=jingle.durationMs+500){
          try{
            await fs.access(path.join(assetsRoot,path.basename(jingle.storageKey)));
            jinglePending=true;
            state.queueStatus='JINGLE';
            return {cursor:{status:'AUTO_DJ',isJingle:true,at:now.toISOString(),slot:null,
              track:{id:jingle.id,name:jingle.name,index:-1,seekMs:0,offsetMs:0,
                durationMs:jingle.durationMs},
              until:Number.isFinite(until)?new Date(until).toISOString():null},
              asset:jingle};
          }catch(error){state.lastError='Jingle file missing: '+jingle.id;}
        }
      }
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
  state.queueStatus='TIMELINE';
  const dsp=await readAudioProcessing();
  const blend=dsp.crossfadeMs>0?crossfadePlan(music,clock,dsp.crossfadeMs):null;
  const track=blend?{
    id:blend.track.id,name:blend.track.name,index:blend.index,
    durationMs:blend.track.playDurationMs,offsetMs:0,seekMs:blend.seekMs,
    remainingMs:blend.remainingMs,blend:blend.mode==='BLEND'?{
      nextId:blend.next.id,nextName:blend.next.name,nextStorageKey:blend.next.storageKey,
      nextSeekMs:blend.nextSeekMs,overlapMs:blend.overlapMs,
      blendPosition:blend.blendPosition,
    }:null,
  }:cueCursor(music,clock);
  const next=await prisma.radioScheduleSlot.findFirst({
    where:{startAt:{gt:now},playlist:{status:'APPROVED'}},
    select:{startAt:true},orderBy:{startAt:'asc'}
  });
  const until=Math.min(next?next.startAt.getTime():Infinity,rotation?.endMs??Infinity);
  if(!track || until-nowMs<150)return {cursor,asset:null};
  return {cursor:{status:'AUTO_DJ',at:now.toISOString(),slot:null,track,
    until: Number.isFinite(until)?new Date(until).toISOString():null},
    asset:music[track.index]};
}
function stopDecoder() {
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

async function run() {
  startEncoder();
  while(!stopping) {
    if(publicLive.onAir){
      state.mode='LIVE';state.trackId=null;state.slotId=null;
      const frame=publicLive.take(Date.now());
      if(frame){if(!encoder.stdin.write(frame))await new Promise(resolve=>encoder.stdin.once('drain',resolve));await new Promise(resolve=>setTimeout(resolve,20));}
      continue;
    }
    let cursor,asset;
    try { ({cursor,asset}=await current()); }
    catch(e) { state.lastError=e.message; state.mode='ERROR'; await new Promise(r=>setTimeout(r,1000));continue; }
    state.slotId=cursor.slot?.id||null;
    if(!asset) {
      state.mode='SILENCE';state.trackId=null;
      for(let i=0;i<5&&!stopping;i++) {
        if(publicLive.onAir)break;
        if(!encoder.stdin.write(silence)) await new Promise(r=>encoder.stdin.once('drain',r));
        await new Promise(r=>setTimeout(r,200));
      }
      continue;
    }
    state.mode=cursor.isJingle?'JINGLE':cursor.status==='AUTO_DJ'?'AUTO_DJ':'SCHEDULED';state.trackId=asset.id;
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
    // A new per-track decoder receives the latest settings. The shared encoder
    // remains alive and scheduled boundaries keep priority over DSP effects.
    let dsp;
    try {dsp=await readAudioProcessing();}catch(error){state.lastError=error.message;dsp={enabled:false,loudnessTarget:-16,truePeak:-2,fadeMs:0,crossfadeMs:0};}
    state.audioProcessing={enabled:dsp.enabled,loudnessTarget:dsp.loudnessTarget,truePeak:dsp.truePeak,fadeMs:dsp.fadeMs,crossfadeMs:dsp.crossfadeMs};
    const filter=audioProcessingFilter(dsp,remaining/1000);
    const blend=cursor.status==='AUTO_DJ'?cursor.track.blend:null;
    let args;
    let usableBlend=blend;
    if(usableBlend){
      const candidate=path.join(assetsRoot,path.basename(usableBlend.nextStorageKey));
      try {await fs.access(candidate);}
      catch {
        state.lastError='Crossfade: next audio unavailable '+usableBlend.nextId;
        usableBlend=null;
      }
    }
    if(usableBlend){
      const nextFilename=path.join(assetsRoot,path.basename(usableBlend.nextStorageKey));
      const fullSeconds=usableBlend.overlapMs/1000;
      const blendStart=usableBlend.blendPosition/1000;
      // Build the complete overlap and discard its elapsed portion. Starting the
      // filter at zero would otherwise restart gain curves after Worker recovery.
      const firstSeek=(cursor.track.seekMs-usableBlend.blendPosition)/1000;
      const secondSeek=(usableBlend.nextSeekMs-usableBlend.blendPosition)/1000;
      args=['-hide_banner','-loglevel','error','-nostdin','-re',
        '-ss',String(firstSeek),'-t',String(fullSeconds),'-i',filename,
        '-re','-ss',String(secondSeek),'-t',String(fullSeconds),'-i',nextFilename,
        '-filter_complex','[0:a][1:a]acrossfade=d='+fullSeconds+':c1=tri:c2=tri,atrim=start='+blendStart+':duration='+(remaining/1000)+',asetpts=PTS-STARTPTS[m]',
        '-map','[m]','-f','s16le','-ac','2','-ar','48000','pipe:1'];
    } else {
      args=['-hide_banner','-loglevel','error','-nostdin','-re',
        '-ss',String((cursor.track.seekMs??cursor.track.offsetMs)/1000),'-i',filename,
        '-t',String(remaining/1000),'-vn',...(filter?['-af',filter]:[]),
        '-f','s16le','-ac','2','-ar','48000','pipe:1'];
    }
    decoder=spawn(ffmpeg,args,{stdio:['ignore','pipe','pipe']});
    const child=decoder;
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
          select:{id:true}
        });
        if(!settings.enabled||!settings.playlistId||scheduled)child.kill('SIGTERM');
        else {
          const playlist=await prisma.radioPlaylist.findUnique({
            where:{id:settings.playlistId},select:{status:true}
          });
          if(playlist?.status!=='APPROVED')child.kill('SIGTERM');
        }
      }catch(error){state.lastError=error.message;}
      finally{polling=false;}
    },3000):null;
    let ended=false, exitCode=null;
    child.stderr.on('data',buf=>{state.lastError=buf.toString().slice(-500);});
    child.on('error',e=>{state.lastError=e.message;});
    child.on('close',code=>{ended=true;exitCode=code;});
    let emittedBytes=0;
    const pcmStaging=PCM_STAGING_ENABLED?new PcmFrameBuffer({frameBytes:4,maxBytes:2*1024*1024}):null;
    const playbackStartedAt=new Date().toISOString();
    try {
      for await(const chunk of child.stdout) {
        if(stopping||publicLive.onAir) {child.kill('SIGTERM');break;}
        const output=pcmStaging?pcmStaging.push(chunk):chunk;
        if(!output?.length)continue;
        if(publicLive.onAir){child.kill('SIGTERM');break;}
        if(!encoder.stdin.write(output)) await new Promise(resolve=>encoder.stdin.once('drain',resolve));
        emittedBytes+=output.length;
      }
    } catch(e) {state.lastError=e.message;}
    if(pcmStaging){
      pcmStaging.finish();
      state.pcmStaging.processedBytes+=pcmStaging.totalBytes;
      state.pcmStaging.droppedTailBytes+=pcmStaging.droppedTailBytes;
    }
    if(watchdog)clearInterval(watchdog);
    // Log only PCM that actually reached the persistent encoder, not planned selections.
    // The event measures generated playout, NOT acoustic proof at the listener.
    const generatedMs=emittedBytes/(48000*2*2)*1000;
    if(generatedMs>=1000){
      const events=playbackAttributions({track:{id:asset.id,name:asset.name},
        blend:usableBlend,generatedMs,startedAt:playbackStartedAt,
        mode:cursor.status,slotId:cursor.slot?.id||null});
      try {await recordPlayoutEvents(events);}
      catch(error){state.lastError='Playback journal: '+error.message;}
    }
    if(cursor.isJingle){
      jinglePending=false;
      if(generatedMs>=1000&&exitCode===0){jinglesPlayed++;musicSinceJingle=0;}
    } else if(cursor.status==='AUTO_DJ'&&generatedMs>=1000&&exitCode===0){
      musicSinceJingle++;
    }
    state.jingles={enabled:JINGLE_PLAYOUT_ENABLED,played:jinglesPlayed,musicSinceJingle};
    if(!ended) child.kill('SIGTERM');
    if(decoder===child) decoder=null;
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
    res.end(JSON.stringify({...state,connected:listeners.size}));return;
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
