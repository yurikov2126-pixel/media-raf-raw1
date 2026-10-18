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
import { readRotation, rotationPlan } from '../src/lib/radioRotation.js';

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
const failedAutoDjAssets = new Map();

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
  const rotation=rotationPlan(catalog,await readRotation(),nowMs);
  const music=rotation?.items||catalog;
  const clock=rotation?nowMs-rotation.anchorMs:nowMs;
  const dsp=await readAudioProcessing();
  const blend=dsp.crossfadeMs>0?crossfadePlan(music,clock,dsp.crossfadeMs):null;
  const track=blend?{
    id:blend.track.id,name:blend.track.name,index:blend.index,
    durationMs:blend.track.playDurationMs,offsetMs:0,seekMs:blend.seekMs,
    remainingMs:blend.remainingMs,blend:blend.mode==='BLEND'?{
      nextId:blend.next.id,nextStorageKey:blend.next.storageKey,
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
async function run() {
  startEncoder();
  while(!stopping) {
    let cursor,asset;
    try { ({cursor,asset}=await current()); }
    catch(e) { state.lastError=e.message; state.mode='ERROR'; await new Promise(r=>setTimeout(r,1000));continue; }
    state.slotId=cursor.slot?.id||null;
    if(!asset) {
      state.mode='SILENCE';state.trackId=null;
      for(let i=0;i<5&&!stopping;i++) {
        if(!encoder.stdin.write(silence)) await new Promise(r=>encoder.stdin.once('drain',r));
        await new Promise(r=>setTimeout(r,200));
      }
      continue;
    }
    state.mode=cursor.status==='AUTO_DJ'?'AUTO_DJ':'SCHEDULED';state.trackId=asset.id;
    const boundary=cursor.status==='AUTO_DJ'?(cursor.until?Date.parse(cursor.until):Infinity):Date.parse(cursor.slot.endAt);
    const remaining=Math.max(0,Math.min(cursor.track.remainingMs??(cursor.track.durationMs-cursor.track.offsetMs),boundary-Date.now()));
    if(remaining<150) continue;
    const filename=path.join(assetsRoot,path.basename(asset.storageKey));
    try {await fs.access(filename);} catch(error) {
      state.lastError='Audio missing: '+asset.id;
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
    try {
      for await(const chunk of child.stdout) {
        if(stopping) break;
        if(!encoder.stdin.write(chunk)) await new Promise(resolve=>encoder.stdin.once('drain',resolve));
      }
    } catch(e) {state.lastError=e.message;}
    if(watchdog)clearInterval(watchdog);
    if(!ended) child.kill('SIGTERM');
    if(decoder===child) decoder=null;
    if(cursor.status==='AUTO_DJ' && exitCode!==null && exitCode!==0 && !child.killed)
      failedAutoDjAssets.set(asset.id,Date.now()+300000);
  }
}

const server=http.createServer((req,res)=>{
  if(!authorized(req)) {res.writeHead(403).end();return;}
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
