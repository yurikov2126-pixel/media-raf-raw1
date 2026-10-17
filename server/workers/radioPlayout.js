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
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { resolveRadioCursor } from '../src/lib/radioTimeline.js';

const port = Number(process.env.RADIO_PLAYOUT_PORT || 4105);
const secret = process.env.RADIO_PLAYOUT_SECRET || '';
if (process.env.RADIO_PLAYOUT_ENABLED !== 'true' || secret.length < 32) {
  throw new Error('Set RADIO_PLAYOUT_ENABLED=true and a shared RADIO_PLAYOUT_SECRET of at least 32 characters');
}
const ffmpeg = process.env.RADIO_FFMPEG_PATH || 'ffmpeg';
const assetsRoot = path.resolve(process.env.RADIO_ASSET_DIR || 'private/radio-audio');
const listeners = new Set();
const state = { mode:'STARTING',trackId:null,slotId:null,connected:0,startedAt:new Date().toISOString(),lastError:null,frames:0 };
let decoder = null;
let encoder = null;
let stopping = false;

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
  const now=new Date();
  const slots=await prisma.radioScheduleSlot.findMany({
    where:{startAt:{lte:now},endAt:{gt:now},playlist:{status:'APPROVED'}},
    include:{playlist:{include:{items:{orderBy:{position:'asc'},include:{asset:true}}}}},
    orderBy:{startAt:'asc'},take:1
  });
  const cursor=resolveRadioCursor(slots,now.getTime());
  const asset=cursor.track?slots[0].playlist.items[cursor.track.index].asset:null;
  return {cursor,asset};
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
    state.mode='SCHEDULED';state.trackId=asset.id;
    const remaining=Math.max(0,Math.min(cursor.track.durationMs-cursor.track.offsetMs,
      new Date(cursor.slot.endAt).getTime()-Date.now()));
    if(remaining<150) continue;
    const filename=path.join(assetsRoot,path.basename(asset.storageKey));
    decoder=spawn(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-re',
      '-ss',String(cursor.track.offsetMs/1000),'-i',filename,
      '-t',String(remaining/1000),'-vn','-f','s16le','-ac','2','-ar','48000','pipe:1'],
      {stdio:['ignore','pipe','pipe']});
    const child=decoder;
    let ended=false;
    child.stderr.on('data',buf=>{state.lastError=buf.toString().slice(-500);});
    child.on('error',e=>{state.lastError=e.message;});
    child.on('close',()=>{ended=true;});
    try {
      for await(const chunk of child.stdout) {
        if(stopping) break;
        if(!encoder.stdin.write(chunk)) await new Promise(resolve=>encoder.stdin.once('drain',resolve));
      }
    } catch(e) {state.lastError=e.message;}
    if(!ended) child.kill('SIGTERM');
    if(decoder===child) decoder=null;
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
