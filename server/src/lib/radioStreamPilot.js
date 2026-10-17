import { spawn } from 'node:child_process';
import path from 'node:path';
import { prisma } from './prisma.js';
import { resolveRadioCursor } from './radioTimeline.js';

const root = path.resolve(process.env.RADIO_ASSET_DIR || 'private/radio-audio');
const active = new Map();
let lastError = null;
let startedAt = null;
const maxListeners = 3;

export async function stationSnapshot() {
  const now = new Date();
  const slots = await prisma.radioScheduleSlot.findMany({
    where: { startAt: { lte: now }, endAt: { gt: now }, playlist: { status: 'APPROVED' } },
    include: { playlist: { include: { items: {
      orderBy: { position: 'asc' }, include: { asset: true },
    } } } },
    orderBy: { startAt: 'asc' }, take: 1,
  });
  return { cursor: resolveRadioCursor(slots, now.getTime()), slot: slots[0] || null };
}

export function stationStreamHealth() {
  return { transport: 'MP3_HTTP_PILOT', status: active.size ? 'STREAMING' : 'STANDBY',
    listeners: active.size, maxListeners, startedAt, lastError, centralizedMixing: false };
}

// Experimental audio transport. Each authenticated client receives a transcoded
// portion of the station timeline; production shared broadcast worker is separate.
export async function servePilotStream(req, res) {
  if (active.size >= maxListeners) return res.status(503).json({ error: 'Лимит тестовых приёмников' });
  const { cursor, slot } = await stationSnapshot();
  if (cursor.status !== 'SCHEDULED' || !slot) return res.status(503).json({ error: 'Нет активной записи по сетке' });
  const items = slot.playlist.items;
  const current = items[cursor.track.index];
  const file = path.join(root, path.basename(current.asset.storageKey));
  // Time bound: never output any part of the track past the published slot window.
  const remaining = Math.min(cursor.track.durationMs - cursor.track.offsetMs,
    new Date(slot.endAt).getTime() - Date.now());
  if (remaining < 300) return res.status(503).json({ error: 'Передача заканчивается' });
  const args = ['-hide_banner','-loglevel','error','-nostdin',
    '-re','-ss', String(cursor.track.offsetMs / 1000),'-i',file,
    '-t',String(remaining / 1000),'-vn','-ac','2','-ar','48000',
    '-c:a','libmp3lame','-b:a','128k','-f','mp3','pipe:1'];
  const ff = spawn(process.env.RADIO_FFMPEG_PATH || 'ffmpeg', args, {
    stdio: ['ignore','pipe','pipe'],
  });
  const key = Symbol('stream');
  active.set(key, ff);
  startedAt = new Date().toISOString();
  res.setHeader('Content-Type','audio/mpeg');
  res.setHeader('Cache-Control','private, no-store, no-transform');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Radio-Track', cursor.track.id);
  res.flushHeaders();
  ff.stdout.pipe(res);
  let diagnostics = '';
  ff.stderr.on('data',chunk => { diagnostics = (diagnostics + chunk.toString()).slice(-1000); });
  const cleanup = () => { active.delete(key); if (!active.size) startedAt=null; };
  req.on('close', () => { if (!ff.killed) ff.kill('SIGTERM'); });
  ff.on('error',e => { lastError = e.message; res.destroy(e); cleanup(); });
  ff.on('close',code => { if (code !== 0 && diagnostics && !req.destroyed) lastError=diagnostics; cleanup(); if (!res.writableEnded) res.end(); });
}
