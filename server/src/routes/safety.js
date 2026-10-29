import {fetchWorkerMchsLabWav} from '../lib/mchsWorkerLabProxy.js';
import { mchsAnalyzerPublicStatus, MCHS_ANALYZER_HEALTH_KEY } from '../lib/mchsAnalyzerHealth.js';
import { summarizeMchsDelivery } from '../lib/mchsDeliveryDiagnostics.js';
import { assessMchsRetryBacklog } from '../lib/mchsRetryBacklog.js';
import { getIo } from '../lib/notify.js';
import { Router } from 'express';
import {makeEmergencyTestWav} from '../lib/mchsIsolatedAudioPreview.js';
import {makeIsolatedHandoverWav} from '../lib/mchsIsolatedHandoverWav.js';
import {workerRequest} from '../lib/radioLiveOpusGateway.js';
import {planRadioEmergencyResume} from '../lib/radioEmergencyResumePlan.js';
import {assessEmergencyAudioTestReadiness} from '../lib/mchsAudioTestReadiness.js';
import {runEmergencySimulationSuite,runEmergencySimulationScenario} from '../lib/mchsEmergencySimulationSuite.js';
import { auth, requireRole } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { hasPermission } from '../lib/roles.js';
import { classifyMchsObservation, MCHS_EVENT_TYPES } from '../lib/mchsClassification.js';
import { inspectMchsObservationOrder } from '../lib/mchsObservationOrder.js';
import { assessMchsQueueObservation } from '../lib/mchsQueueAssessment.js';

const router = Router();
const KEY = 'safety_mchs_config_v1';
const defaults = Object.freeze({
  enabled: false,
  testMode: true,
  destinations: { radio: true, speakers: true },
  region: 'Тульская область',
  androidHostLabel: 'mchs-android',
  notes: '',
});
const auditKey = 'safety_mchs_config_history_v1';
const denied = (res) => res.status(403).json({ error: 'Нет прав на управление оповещениями' });

async function canView(req, res, next) {
  try {
    if (await hasPermission(req.user, 'safety.view')) return next();
    return denied(res);
  } catch (error) { return next(error); }
}
function sanitize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof value.enabled !== 'boolean' || typeof value.testMode !== 'boolean') return null;
  if (!value.destinations || typeof value.destinations.radio !== 'boolean' || typeof value.destinations.speakers !== 'boolean') return null;
  if (typeof value.region !== 'string' || value.region.length > 120 || typeof value.notes !== 'string' || value.notes.length > 500) return null;
  // Phase 1 must never enable live automation, even through a forged API request.
  if (value.enabled || !value.testMode) return null;
  return { ...defaults, enabled: false, testMode: true,
    destinations: { radio: value.destinations.radio, speakers: value.destinations.speakers },
    region: value.region.trim(), notes: value.notes.trim() };
}
async function load() {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  try {
    const saved = JSON.parse(row?.value || '{}');
    return { ...defaults, ...saved, enabled: false, testMode: true,
      destinations: { ...defaults.destinations, ...saved?.destinations } };
  } catch { return defaults; }
}
router.use(auth);
// No actual control commands are accepted here. Pure in-process diagnostics only.
// Read-only worker health; distinct from simulator success and physical output verification.
// Real schedule snapshot + worker status, READ ONLY. No emergency commands, no playout.
// Conservative production preflight: never accepts a client claim that hardware is isolated.
// Download-only synthetic chime; does not touch Radio Worker or PA hardware.
// Static offline audio handover demonstration; no access to the station mixer.
router.get('/worker-lab/handover.wav',canView,async (_req,res)=>{
 try{
  const wav=await fetchWorkerMchsLabWav();
  res.set({'Content-Type':'audio/wav','Content-Length':String(wav.length),'Cache-Control':'no-store'});
  res.end(wav);
 }catch(err){
  // Diagnostic categories only: never expose worker secrets, ports or internal addresses.
  const reason=err?.message||'';
  const code=reason==='WORKER_NOT_CONFIGURED'?'WORKER_NOT_CONFIGURED':
    reason==='WORKER_HTTP_403'?'WORKER_AUTH_FAILED':
    reason==='WORKER_HTTP_404'?'WORKER_ROUTE_MISSING':
    reason==='WORKER_TIMEOUT'||reason==='ETIMEDOUT'?'WORKER_TIMEOUT':
    reason==='ECONNREFUSED'||reason==='ECONNRESET'||reason==='EHOSTUNREACH'?'WORKER_UNREACHABLE':
    reason==='LAB_WAV_TOO_LARGE'||reason==='INVALID_WORKER_AUDIO'?'WORKER_INVALID_AUDIO':
    'WORKER_REQUEST_FAILED';
  console.warn('MCHS_WORKER_LAB_FAILURE',code);
  res.set('Cache-Control','no-store').status(503).json({error:'Worker lab unavailable',code});
 }
});
router.get('/isolated-handover.wav',canView,(_req,res)=>{
 const wav=makeIsolatedHandoverWav();
 res.set({'Content-Type':'audio/wav','Content-Length':String(wav.length),
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'Content-Disposition':'attachment; filename="mchs-isolated-handover.wav"'});
 res.end(wav);
});
router.get('/isolated-test-tone.wav', canView, (_req,res) => {
  const data=makeEmergencyTestWav();
  res.set({'Content-Type':'audio/wav','Content-Length':String(data.length),
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    'Content-Disposition':'attachment; filename="mchs-isolated-test.wav"'});
  res.end(data);
});
router.get('/audio-test-readiness', canView, async (_req,res,next) => {
  try {
    const now=new Date();
    const [workerResult,slots]=await Promise.all([
      workerRequest('GET','/health').then(value=>({ok:true,value})).catch(()=>({ok:false,value:null})),
      prisma.radioScheduleSlot.findMany({
        where:{startAt:{lte:now},endAt:{gt:now},playlist:{status:'APPROVED'}},
        include:{playlist:{include:{items:{orderBy:{position:'asc'},include:{asset:{
          select:{id:true,name:true,durationMs:true}
        }}}}}},orderBy:{startAt:'asc'},take:5
      })
    ]);
    const worker=workerResult.value;
    const verdict=assessEmergencyAudioTestReadiness({
      workerReachable:workerResult.ok,workerSource:worker?.mode||'UNKNOWN',
      workerError:worker?.lastError||null,nowMs:now.getTime(),slots
      // No server-side evidence yet for isolation, stop, rollback or supervised tests.
    });
    res.set('Cache-Control','no-store');
    res.json({checkedAt:now.toISOString(),source:worker?.mode||'UNKNOWN',...verdict});
  }catch(error){next(error);}
});
router.get('/radio-resume-diagnostic', canView, async (_req,res,next) => {
  try {
    const at=new Date();
    const [slots,workerResult]=await Promise.all([
      prisma.radioScheduleSlot.findMany({
        where:{startAt:{lte:at},endAt:{gt:at},playlist:{status:'APPROVED'}},
        include:{playlist:{include:{items:{orderBy:{position:'asc'},include:{asset:{
          select:{id:true,name:true,durationMs:true}
        }}}}}},orderBy:{startAt:'asc'},take:5
      }),
      workerRequest('GET','/health').then(value=>({ok:true,value}))
        .catch(()=>({ok:false,value:null}))
    ]);
    const worker=workerResult.value;
    const source=workerResult.ok?String(worker?.mode||'UNKNOWN'):'UNKNOWN';
    const plan=workerResult.ok?planRadioEmergencyResume({
      source,nowMs:at.getTime(),slots,previousTrackId:worker?.trackId||null,
      // Live and playlist authority cannot be proven by health alone.
      liveConnected:false,liveAuthorized:false,playlistActive:false
    }):{ready:false,action:'RECHECK_STATION_AUTHORITY',reason:'WORKER_UNAVAILABLE',simulationOnly:true};
    res.set('Cache-Control','no-store');
    res.json({checkedAt:at.toISOString(),workerReachable:workerResult.ok,
      currentSource:source,workerTrackId:worker?.trackId||null,workerSlotId:worker?.slotId||null,
      scheduledSlotIds:slots.map(x=>x.id),plan,
      liveAuthorityVerified:false,playlistAuthorityVerified:false,
      simulationOnly:true,programRestorationVerified:false,audioOutputVerified:false,playbackChanged:false});
  }catch(error){next(error);}
});
router.get('/radio-worker-readiness', canView, async (_req,res) => {
  res.set('Cache-Control','no-store');
  try {
    const worker=await workerRequest('GET','/health');
    const source=String(worker?.mode||'UNKNOWN');
    const recognized=['AUTO_DJ','SCHEDULE','LIVE','MANUAL_PLAYLIST','AUTO_PLAYLIST'].includes(source);
    res.json({reachable:true,source,sourceRecognized:recognized,trackId:worker?.trackId||null,
      slotId:worker?.slotId||null,nextTrackId:worker?.nextTrackId||null,
      frames:Number.isFinite(worker?.frames)?worker.frames:null,
      lastError:worker?.lastError||null,connected:worker?.connected??null,
      startedAt:worker?.startedAt||null,
      emergencySimulation:worker?.emergencySimulation?.mode==='DRY_RUN_ONLY'?'DRY_RUN_ONLY':null,
      programRestorationVerified:false,audioOutputVerified:false,amplifierVerified:false,
      diagnosticOnly:true,playbackChanged:false});
  } catch(error) {
    res.status(503).json({reachable:false,reason:'WORKER_HEALTH_UNAVAILABLE',diagnosticOnly:true,
      programRestorationVerified:false,audioOutputVerified:false,amplifierVerified:false});
  }
});
router.get('/emergency-simulation', canView, (req,res) => {
  const source=String(req.query.source||'');
  const result=source?runEmergencySimulationScenario(source):runEmergencySimulationSuite();
  res.set('Cache-Control','no-store');
  res.status(result.ok===false?400:200).json(result);
});
router.get('/access', canView, (_req, res) => res.json({ allowed: true, canConfigure: _req.user.role === 'ADMIN' }));
router.get('/dashboard', canView, async (_req, res, next) => {
  try {
    const config = await load();
    res.set('Cache-Control', 'no-store');
    const [events, count, health, diagnostics, diagnosticCount] = await Promise.all([
      prisma.safetyMchsEvent.findMany({ orderBy: { receivedAt: 'desc' }, take: 50, select: {
        id: true, source: true, receivedAt: true, occurredAt: true, title: true,
        body: true, channelId: true, region: true, eventType: true, verified: true,
      } }),
      prisma.safetyMchsEvent.count(),
      prisma.safetyMchsHealth.findUnique({ where: { id: 'mchs-android' } }),
      prisma.safetyMchsDiagnostic.findMany({ orderBy: { receivedAt: 'desc' }, take: 20, select: { id: true, eventId: true, receivedAt: true } }),
      prisma.safetyMchsDiagnostic.count(),
    ]);
    const lastSeenMs = health?.lastSeenAt ? new Date(health.lastSeenAt).getTime() : null;
    const online = lastSeenMs !== null && Date.now() - lastSeenMs < 180000;
    res.json({
      config,
      source: { name: 'МЧС России / Android', connection: online ? 'HEARTBEAT_RECENT' : health ? 'HEARTBEAT_STALE' : 'NOT_CONFIGURED', lastSeen: health?.lastSeenAt || null, listener: online ? health.listener : 'UNVERIFIED', push: online ? health.push : 'UNVERIFIED' },
      integration: {
        status: process.env.MCHS_INGEST_ENABLED === 'true' ? 'OBSERVATION_RECEIVER_ENABLED' : 'DISABLED',
        receiverConfigured: process.env.MCHS_INGEST_ENABLED === 'true' && (process.env.MCHS_INGEST_HMAC_KEY || '').length >= 32,
        deliveryVerified: count > 0,
        deliveryMode: 'MANUAL_CONFIRMED_AUTOMATIC_UNVERIFIED',
        lastReceivedAt: events[0]?.receivedAt || null,
        automaticDeliveryVerified: false,
      },
      events,
      diagnosticEvents: diagnostics,
      diagnosticCount,
      diagnosticIngestEnabled: process.env.MCHS_DIAGNOSTIC_ENABLED === 'true' && (process.env.MCHS_DIAGNOSTIC_HMAC_KEY || '').length >= 32,
      eventCount: count,
      eventHistoryAvailable: true,
      liveActivationAvailable: false,
      message: count > 0 ? 'Исторические уведомления Android поступали в журнал. Автоматическая доставка и подлинность сообщений не подтверждены.' : 'События Android пока не поступали. Пустой журнал не означает отсутствия предупреждений МЧС.',
    });
  } catch (error) { next(error); }
});
router.get('/events', canView, async (req, res, next) => {
  try {
    const take = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
    const events = await prisma.safetyMchsEvent.findMany({
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }], take,
      select: { id: true, source: true, sourceEventId: true, receivedAt: true,
        occurredAt: true, title: true, body: true, channelId: true, region: true,
        eventType: true, verified: true }
    });
    res.set('Cache-Control', 'no-store');
    res.json({ events, ingestionEnabled: process.env.MCHS_INGEST_ENABLED === 'true' });
  } catch (error) { next(error); }
});

/**
 * Operator-only policy drafts. Deliberately never consumed by ingest,
 * dispatch, radio or any scheduled job. Default is OFF for every event.
 */
const POLICY_KEY = 'mchs_notification_policy_drafts_v1';
const policyModes = new Set(['IGNORE', 'REVIEW']);
async function policies() {
  const stored = await prisma.setting.findUnique({ where: { key: POLICY_KEY } });
  try {
    const value = JSON.parse(stored?.value || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
router.get('/notification-policy-drafts', canView, async (_req, res, next) => {
  try {
    const [rules, assets] = await Promise.all([
      policies(),
      prisma.radioAsset.findMany({
        where: { mimeType: { startsWith: 'audio/' }, category: 'ALARM' },
        select: { id: true, name: true, durationMs: true, category: true },
        orderBy: { createdAt: 'desc' }, take: 200,
      }),
    ]);
    res.set('Cache-Control', 'no-store');
    return res.json({ rules, assets, liveDispatchEnabled: false,
      description: 'Настройки для анализа и предварительного выбора. Ни одна запись не запускает радио.' });
  } catch (error) { next(error); }
});
router.put('/notification-policy-drafts/:eventId', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const event = await prisma.safetyMchsEvent.findUnique({ where: { id: req.params.eventId },
      select: { id: true, sourceEventId: true } });
    if (!event) return res.status(404).json({ error: 'EVENT_NOT_FOUND' });
    const { mode, audioAssetId, note } = req.body || {};
    if (!policyModes.has(mode) || typeof note !== 'string' || note.length > 500 ||
        (audioAssetId !== null && audioAssetId !== undefined && (typeof audioAssetId !== 'string' || audioAssetId.length > 120))) {
      return res.status(400).json({ error: 'INVALID_POLICY' });
    }
    if (audioAssetId) {
      const asset = await prisma.radioAsset.findUnique({ where: { id: audioAssetId }, select: { mimeType: true, category: true } });
      if (!asset?.mimeType?.startsWith('audio/') || asset.category !== 'ALARM') return res.status(400).json({ error: 'AUDIO_ASSET_NOT_FOUND' });
    }
    // A single JSON document serializes per-event choices; concurrent edits use an
    // advisory PostgreSQL transaction lock to prevent lost updates.
    const entry = { mode, audioAssetId: audioAssetId || null, note: note.trim(),
      updatedAt: new Date().toISOString(), updatedBy: req.user.id, executable: false };
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581420)`;
      const row = await tx.setting.findUnique({ where: { key: POLICY_KEY } });
      let existing = {};
      try { const parsed = JSON.parse(row?.value || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existing = parsed; } catch {}
      existing[event.id] = entry;
      await tx.setting.upsert({ where: { key: POLICY_KEY },
        create: { key: POLICY_KEY, value: JSON.stringify(existing) },
        update: { value: JSON.stringify(existing) } });
    });
    res.set('Cache-Control', 'no-store');
    res.json({ saved: true, eventId: event.id, rule: entry, liveDispatchEnabled: false });
  } catch (error) { next(error); }
});


const TYPE_RULE_KEY = 'mchs_four_type_rules_v1';
const emptyTypeRule = () => ({ mode: 'IGNORE', audioAssetId: null, note: '', executable: false });
async function getTypeRules() {
  const row = await prisma.setting.findUnique({ where: { key: TYPE_RULE_KEY } });
  let stored = {};
  try { const parsed = JSON.parse(row?.value || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) stored = parsed; } catch {}
  return Object.fromEntries(MCHS_EVENT_TYPES.map(type => [type.id, { ...emptyTypeRule(), ...(stored[type.id] || {}), executable: false }]));
}
router.get('/event-type-rules', canView, async (_req, res, next) => {
  try {
    const [rules, assets] = await Promise.all([getTypeRules(),
      prisma.radioAsset.findMany({ where: { mimeType: { startsWith: 'audio/' }, category: 'ALARM' },
        select: { id: true, name: true, durationMs: true }, orderBy: { createdAt: 'desc' }, take: 200 })]);
    const recent = await prisma.safetyMchsEvent.findMany({ orderBy: { receivedAt: 'desc' }, take: 100,
      select: { id: true, title: true, body: true, eventType: true } });
    res.set('Cache-Control', 'no-store');
    return res.json({ types: MCHS_EVENT_TYPES, rules, assets, liveDispatchEnabled: false,
      classifications: recent.map(e => ({ id: e.id, type: classifyMchsObservation(e.title, e.body) })) });
  } catch (error) { next(error); }
});
router.put('/event-type-rules/:type', requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (!MCHS_EVENT_TYPES.some(t => t.id === req.params.type)) return res.status(404).json({ error: 'UNKNOWN_TYPE' });
    const { mode, audioAssetId, note } = req.body || {};
    if (!['IGNORE', 'REVIEW'].includes(mode) || typeof note !== 'string' || note.length > 500 ||
        (audioAssetId != null && (typeof audioAssetId !== 'string' || audioAssetId.length > 120)))
      return res.status(400).json({ error: 'INVALID_TYPE_RULE' });
    if (audioAssetId) {
      const asset = await prisma.radioAsset.findUnique({ where: { id: audioAssetId }, select: { mimeType: true, category: true } });
      if (!asset?.mimeType?.startsWith('audio/') || asset.category !== 'ALARM') return res.status(400).json({ error: 'AUDIO_ASSET_NOT_FOUND' });
    }
    const entry = { mode, audioAssetId: audioAssetId || null, note: note.trim(), executable: false,
      updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581421)`;
      const row = await tx.setting.findUnique({ where: { key: TYPE_RULE_KEY } });
      let stored = {};
      try { const obj = JSON.parse(row?.value || '{}'); if (obj && typeof obj === 'object' && !Array.isArray(obj)) stored = obj; } catch {}
      stored[req.params.type] = entry;
      await tx.setting.upsert({ where: { key: TYPE_RULE_KEY },
        create: { key: TYPE_RULE_KEY, value: JSON.stringify(stored) },
        update: { value: JSON.stringify(stored) } });
    });
    res.json({ saved: true, rule: entry, liveDispatchEnabled: false });
  } catch (error) { next(error); }
});


/** Dispatch mode staging: never grants access to radio/PA playout. */
const DISPATCH_MODE_KEY = 'mchs_dispatch_mode_staging_v1';
router.get('/dispatch-mode', canView, async (_req, res, next) => {
  try {
    const row = await prisma.setting.findUnique({ where: { key: DISPATCH_MODE_KEY } });
    let mode = 'MANUAL';
    try { const parsed = JSON.parse(row?.value || '{}'); if (['MANUAL','AUTO_SIMULATION'].includes(parsed.mode)) mode = parsed.mode; } catch {}
    res.set('Cache-Control', 'no-store');
    res.json({ mode, realPlaybackEnabled: false, automaticPlaybackEnabled: false, output: 'ISOLATED_SIMULATION_ONLY' });
  } catch (error) { next(error); }
});
router.put('/dispatch-mode', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const mode = req.body?.mode;
    if (!['MANUAL','AUTO_SIMULATION'].includes(mode) || Object.keys(req.body || {}).some(k => k !== 'mode'))
      return res.status(400).json({ error: 'INVALID_DISPATCH_MODE' });
    const entry = { mode, updatedAt: new Date().toISOString(), updatedBy: req.user.id,
      realPlaybackEnabled: false };
    await prisma.setting.upsert({ where: { key: DISPATCH_MODE_KEY },
      create: { key: DISPATCH_MODE_KEY, value: JSON.stringify(entry) },
      update: { value: JSON.stringify(entry) } });
    res.json({ ...entry, automaticPlaybackEnabled: false, output: 'ISOLATED_SIMULATION_ONLY' });
  } catch (error) { next(error); }
});


/** Read-only what-would-happen preview: no playback and no dispatch writes. */
router.get('/dispatch-preview', canView, async (_req, res, next) => {
  try {
    const [events, rules, assetRows] = await Promise.all([
      prisma.safetyMchsEvent.findMany({ orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        take: 100, select: { id: true, title: true, body: true, occurredAt: true,
          receivedAt: true, region: true, sourceEventId: true } }),
      getTypeRules(),
      prisma.radioAsset.findMany({ where: { category: 'ALARM', mimeType: { startsWith: 'audio/' } },
        select: { id: true, name: true } }),
    ]);
    const assets = new Map(assetRows.map(asset => [asset.id, asset.name]));
    const now = Date.now();
    const seen = new Set();
    const decisions = events.map(event => {
      const eventType = classifyMchsObservation(event.title, event.body);
      const rule = rules[eventType];
      const occurred = event.occurredAt ? new Date(event.occurredAt).getTime() : NaN;
      const ageMs = Number.isFinite(occurred) ? now - occurred : null;
      let reason = null;
      if (seen.has(event.sourceEventId)) reason = 'DUPLICATE';
      else if (eventType === 'UNCLASSIFIED') reason = 'UNCLASSIFIED';
      else if (ageMs === null || ageMs < -120000 || ageMs > 120000) reason = 'STALE_OR_UNKNOWN_TIME';
      else if (rule?.mode !== 'REVIEW') reason = 'RULE_DISABLED';
      else if (!rule.audioAssetId || !assets.has(rule.audioAssetId)) reason = 'ALARM_AUDIO_MISSING';
      else if (!event.region || !/ТУЛЬСК/i.test(event.region)) reason = 'REGION_UNVERIFIED';
      seen.add(event.sourceEventId);
      return { eventId: event.id, eventType, occurredAt: event.occurredAt,
        receivedAt: event.receivedAt, ageMs, status: reason ? 'BLOCKED' : 'READY_FOR_OPERATOR_REVIEW',
        reason, audioAssetId: reason ? null : rule.audioAssetId,
        audioName: reason ? null : assets.get(rule.audioAssetId) };
    });
    res.set('Cache-Control', 'no-store');
    res.json({ mode: 'READ_ONLY_PREVIEW', speakerPlaybackEnabled: false,
      evaluatedCount: decisions.length, decisions });
  } catch (error) { next(error); }
});


/** Persisted operator review notes only. No dispatch or speaker actions. */
const REVIEW_KEY = 'mchs_operator_reviews_v1';
router.get('/operator-reviews', canView, async (_req, res, next) => {
  try {
    const row = await prisma.setting.findUnique({ where: { key: REVIEW_KEY } });
    let reviews = {};
    try { const parsed = JSON.parse(row?.value || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) reviews = parsed; } catch {}
    res.set('Cache-Control', 'no-store');
    res.json({ reviews, playbackEnabled: false });
  } catch (error) { next(error); }
});
router.put('/operator-reviews/:eventId', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { decision, note } = req.body || {};
    if (!['ACKNOWLEDGED','DISMISSED'].includes(decision) || typeof note !== 'string' ||
        note.trim().length < 3 || note.length > 500 || Object.keys(req.body).some(k => !['decision','note'].includes(k)))
      return res.status(400).json({ error: 'INVALID_REVIEW' });
    const exists = await prisma.safetyMchsEvent.findUnique({ where: { id: req.params.eventId }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'EVENT_NOT_FOUND' });
    const entry = { decision, note: note.trim(), reviewedAt: new Date().toISOString(),
      reviewedBy: req.user.id, playbackRequested: false };
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581422)`;
      const row = await tx.setting.findUnique({ where: { key: REVIEW_KEY } });
      let reviews = {};
      try { const parsed = JSON.parse(row?.value || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) reviews = parsed; } catch {}
      if (reviews[exists.id]) return;
      reviews[exists.id] = entry;
      await tx.setting.upsert({ where: { key: REVIEW_KEY },
        create: { key: REVIEW_KEY, value: JSON.stringify(reviews) },
        update: { value: JSON.stringify(reviews) } });
    });
    const current = await prisma.setting.findUnique({ where: { key: REVIEW_KEY } });
    const saved = JSON.parse(current?.value || '{}')[exists.id];
    res.set('Cache-Control', 'no-store');
    res.json({ eventId: exists.id, review: saved, alreadyReviewed: saved.reviewedAt !== entry.reviewedAt,
      playbackEnabled: false });
  } catch (error) { next(error); }
});

/** Telemetry only: heartbeat does not prove that no push notifications were missed. */
// Explicit admin-only socket probe. Not an MCHS event or technical incident.
router.post('/technical-notification-probe', requireRole('ADMIN'), async (req,res,next)=>{
  try {
    const since=new Date(Date.now()-60000);
    const recent=await prisma.notification.findMany({
      where:{userId:req.user.id,type:'system',createdAt:{gte:since}},
      select:{payload:true},take:50
    });
    if(recent.some(n=>{try{return JSON.parse(n.payload)?.diagnosticProbe===true;}catch{return false;}}))
      return res.status(429).json({error:'PROBE_COOLDOWN'});
    const payload={
      title:'Проверка уведомлений МЧС · тест',
      message:'Тест доставки Socket.IO. Это НЕ предупреждение МЧС и НЕ неисправность.',
      url:'/app/admin?tab=safety-mchs',diagnosticProbe:true,diagnosticOnly:true,officialAlert:false
    };
    const notification=await prisma.notification.create({
      data:{userId:req.user.id,type:'system',payload:JSON.stringify(payload)}
    });
    getIo()?.to(`user:${req.user.id}`).emit('notification:new',{...notification,payload});
    res.set('Cache-Control','no-store');
    return res.json({ok:true,notificationId:notification.id,socketAvailable:Boolean(getIo()),testOnly:true});
  }catch(error){next(error);}
});
/** Historical diagnostics only; no assertion of push completeness or official alert validity. */
router.get('/analytics', canView, async (req,res,next) => {
  try {
    const days = [7,30,90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const since = new Date(Date.now() - days * 86400000);
    const [events,queues,incidents,reviewsRow] = await Promise.all([
      prisma.safetyMchsEvent.findMany({where:{receivedAt:{gte:since}},
        select:{id:true,receivedAt:true,source:true,eventType:true},orderBy:{receivedAt:'asc'},take:10000}),
      prisma.safetyMchsQueueItem.findMany({where:{createdAt:{gte:since}},
        select:{eventId:true,status:true,createdAt:true,updatedAt:true},take:10000}),
      prisma.safetyMchsTechnicalIncident.findMany({where:{openedAt:{gte:since}},
        select:{kind:true,openedAt:true,resolvedAt:true},take:10000}),
      prisma.setting.findUnique({where:{key:REVIEW_KEY}})
    ]);
    const series=Array.from({length:days},(_,i)=>{
      const date=new Date(since.getTime()+i*86400000).toISOString().slice(0,10);
      return {date,messages:0,analyzed:0,incidents:0,reviews:0};
    });
    const byDay=new Map(series.map(row=>[row.date,row]));
    const add=(at,key)=>{const row=byDay.get(new Date(at).toISOString().slice(0,10));if(row)row[key]++;};
    for(const e of events)add(e.receivedAt,'messages');
    const times=[];
    for(const q of queues){
      if(q.status==='ANALYZED'){add(q.updatedAt,'analyzed');const ms=new Date(q.updatedAt)-new Date(q.createdAt);if(ms>=0&&Number.isFinite(ms))times.push(ms);}
    }
    for(const i of incidents)add(i.openedAt,'incidents');
    let reviews={};try{reviews=JSON.parse(reviewsRow?.value||'{}');}catch{}
    const eventIds=new Set(events.map(e=>e.id));
    let reviewCount=0;
    for(const [id,review] of Object.entries(reviews)){
      if(eventIds.has(id)&&review?.reviewedAt&&new Date(review.reviewedAt)>=since){add(review.reviewedAt,'reviews');reviewCount++;}
    }
    const averageAnalysisMs=times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length):null;
    res.set('Cache-Control','no-store');
    res.json({days,series,totals:{messages:events.length,analyzed:queues.filter(q=>q.status==='ANALYZED').length,
      pending:queues.filter(q=>q.status==='OBSERVED').length,incidents:incidents.length,
      openIncidents:incidents.filter(i=>!i.resolvedAt).length,reviews:reviewCount,averageAnalysisMs},
      limits:{maxRowsPerTable:10000,truncated:events.length===10000||queues.length===10000||incidents.length===10000},
      scope:'OBSERVED_DIAGNOSTICS_ONLY',officialVerified:false,automaticDeliveryVerified:false,playbackEnabled:false});
  }catch(error){next(error);}
});
router.get('/technical-incidents', canView, async (_req,res,next) => {
  try {
    const rows=await prisma.safetyMchsTechnicalIncident.findMany({
      orderBy:[{openedAt:'desc'},{id:'desc'}],take:100,
      select:{id:true,kind:true,reason:true,openedAt:true,resolvedAt:true}
    });
    res.set('Cache-Control','no-store');
    res.json({items:rows,observationOnly:true,playbackEnabled:false});
  }catch(error){next(error);}
});
// Historical heartbeat snapshots; not proof of push delivery or official alert validity.
// Read-only anomaly assessment of sampled Android VM health. No radio dispatch authority.
router.get('/telemetry-alerts', canView, async (req,res,next) => {
  try {
    const now=Date.now();
    const windowStart=new Date(now-60*60000);
    const [samples,health]=await Promise.all([
      prisma.safetyMchsTelemetrySample.findMany({
        where:{receivedAt:{gte:windowStart}},
        orderBy:{receivedAt:'desc'},take:200,
        select:{receivedAt:true,queuedLocal:true,retryPending:true,failedSends:true,
          telemetryPresent:true,snapshotOk:true}
      }),
      prisma.safetyMchsHealth.findUnique({where:{id:'mchs-android'},
        select:{lastSeenAt:true,telemetryAt:true}})
    ]);
    const alerts=[];
    const latest=samples[0];
    const age=health?.lastSeenAt?now-new Date(health.lastSeenAt).getTime():null;
    if(age===null || age>5*60000)alerts.push({
      code:'HEARTBEAT_GAP',severity:'attention',title:'Нет свежего heartbeat Android VM',
      detail:age===null?'Контакт не зарегистрирован':'Последний контакт '+Math.round(age/60000)+' мин назад',
      since:health?.lastSeenAt||null
    });
    const recent=samples.filter(x=>x.telemetryPresent && now-new Date(x.receivedAt).getTime()<=15*60000);
    if(recent.length>=3){
      const backlog=recent.filter(x=>x.queuedLocal!==null&&x.queuedLocal>=5);
      if(backlog.length>=3)alerts.push({code:'LOCAL_BACKLOG',severity:'attention',
        title:'Устойчивая локальная очередь Android',detail:'Не менее 3 свежих снимков с 5 и более сообщениями',since:backlog[backlog.length-1].receivedAt});
      const retries=recent.filter(x=>x.retryPending!==null&&x.retryPending>0);
      if(retries.length>=3)alerts.push({code:'RETRY_PENDING',severity:'attention',
        title:'Повторные отправки ожидают выполнения',detail:'Повторы отмечены в 3 и более свежих снимках',since:retries[retries.length-1].receivedAt});
      const sqlite=recent.filter(x=>x.snapshotOk===false);
      if(sqlite.length>=3)alerts.push({code:'SQLITE_FAILURE',severity:'attention',
        title:'Повторяющиеся ошибки чтения SQLite',detail:'Не менее 3 отрицательных снимков за 15 минут',since:sqlite[sqlite.length-1].receivedAt});
    }
    const telemetryAge=health?.telemetryAt?now-new Date(health.telemetryAt).getTime():null;
    if(age!==null&&age<=5*60000&&(telemetryAge===null||telemetryAge>10*60000))
      alerts.push({code:'TELEMETRY_STALE',severity:'unknown',title:'Heartbeat есть, но телеметрия устарела',
        detail:'Новые сведения об очереди не поступали более 10 минут',since:health?.telemetryAt||null});
    res.set('Cache-Control','no-store');
    res.json({alerts,checkedAt:new Date(),sampleCount:samples.length,
      status:alerts.some(x=>x.severity==='attention')?'ATTENTION':alerts.length?'UNKNOWN':'NO_DETECTED_ANOMALIES',
      limitations:'Checks operate on recent stored snapshots. A clean result is not proof of delivery.',
      playbackEnabled:false,officialVerified:false});
  }catch(error){next(error);}
});
router.get('/telemetry-history', canView, async (req,res,next) => {
  try {
    const hours=[24,72,168].includes(Number(req.query.hours))?Number(req.query.hours):24;
    const since=new Date(Date.now()-hours*3600000);
    const rows=await prisma.safetyMchsTelemetrySample.findMany({
      where:{receivedAt:{gte:since}},orderBy:{receivedAt:'desc'},take:3000,
      select:{id:true,receivedAt:true,listener:true,push:true,telemetryPresent:true,
        queuedLocal:true,failedSends:true,retryPending:true,oldestPendingAt:true,
        nextRetryAt:true,snapshotOk:true,snapshotAt:true,lastSentAt:true}
    });
    const chronological=rows.reverse();
    res.set('Cache-Control','no-store');
    res.json({hours,items:chronological,truncated:rows.length===3000,
      scope:'ANDROID_HEARTBEAT_TELEMETRY',officialVerified:false,playbackEnabled:false});
  } catch(error){next(error);}
});
router.get('/delivery-diagnostics', canView, async (_req,res,next) => {
  try {
    const [health,lastEvent,pending] = await Promise.all([
      prisma.safetyMchsHealth.findUnique({where:{id:'mchs-android'},
        select:{lastSeenAt:true,listener:true,push:true,queuedLocal:true,failedSends:true,lastSentAt:true,telemetryAt:true,snapshotOk:true,snapshotAt:true,retryPending:true,nextRetryAt:true,oldestPendingAt:true}}),
      prisma.safetyMchsEvent.findFirst({orderBy:[{receivedAt:'desc'},{id:'desc'}],
        select:{occurredAt:true,receivedAt:true}}),
      prisma.safetyMchsQueueItem.count({where:{status:'OBSERVED'}}),
    ]);
    const configured=process.env.MCHS_OBSERVATION_ANALYZER_ENABLED==='true' && process.env.PREVIEW_MODE!=='true';
    const data=summarizeMchsDelivery({health,lastEvent,pending,
      analyzer:mchsAnalyzerPublicStatus(configured)});
    res.set('Cache-Control','no-store');
    res.json({...data,vmTelemetry:{
      available:Boolean(health?.telemetryAt),
      lastReportedAt:health?.telemetryAt||null,
      queuedLocal:health?.queuedLocal??null,
      failedSends:health?.failedSends??null,
      lastSentAt:health?.lastSentAt||null,
      oldestPendingAt:health?.oldestPendingAt||null,
      oldestPendingAgeMs:health?.oldestPendingAt ? Math.max(0,Date.now()-new Date(health.oldestPendingAt).getTime()) : null,
      retryPending:health?.retryPending??null,
      nextRetryAt:health?.nextRetryAt||null,
      snapshotOk:health?.snapshotOk??null,
      snapshotAt:health?.snapshotAt||null,
      countersAreSelfReported:true,
      telemetryFresh:Boolean(health?.telemetryAt&&Date.now()-new Date(health.telemetryAt).getTime()<180000),
      backlog:assessMchsRetryBacklog(health)
    }});
  } catch(error){next(error);}
});

/** Configuration visibility is not a heartbeat or execution proof. */
router.get('/observation-analyzer/status', canView, async (_req,res,next) => {
  try {
    const configured = process.env.MCHS_OBSERVATION_ANALYZER_ENABLED === 'true' &&
      process.env.PREVIEW_MODE !== 'true';
    const persisted = await prisma.setting.findUnique({
      where:{key:MCHS_ANALYZER_HEALTH_KEY},select:{value:true}
    });
    let saved=null;
    try { saved=JSON.parse(persisted?.value||'null'); } catch {}
    const current=mchsAnalyzerPublicStatus(configured);
    res.set('Cache-Control','no-store');
    res.json({...current,saved,playbackEnabled:false});
  } catch(error){next(error);}
});

/** Read-only durable observation queue; not a command queue. */
/** Read-only event-specific diagnostic trace; never establishes alert authenticity. */
router.get('/message-history/:eventId', canView, async (req, res, next) => {
  try {
    const event = await prisma.safetyMchsEvent.findUnique({
      where: { id: req.params.eventId }, select: { id: true, receivedAt: true }
    });
    if (!event) return res.status(404).json({error:'EVENT_NOT_FOUND'});
    const queueItems = await prisma.safetyMchsQueueItem.findMany({
      where: { eventId: event.id },
      select: {
        id:true,status:true,attempts:true,lastError:true,createdAt:true,updatedAt:true,
        history:{orderBy:[{createdAt:'asc'},{id:'asc'}],take:100,
          select:{id:true,status:true,reason:true,createdAt:true}}
      }
    });
    const row = await prisma.setting.findUnique({where:{key:REVIEW_KEY}});
    let review = null;
    try { const parsed=JSON.parse(row?.value||'{}'); review=parsed?.[event.id]||null; } catch {}
    res.set('Cache-Control','no-store');
    res.json({eventId:event.id,receivedAt:event.receivedAt,
      queues:queueItems,review,officialVerified:false,playbackEnabled:false});
  } catch(error) { next(error); }
});
router.get('/observation-queue', canView, async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query.limit || '30'), 10) || 30));
    const [items, total, pending, analyzed] = await Promise.all([
      prisma.safetyMchsQueueItem.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit,
        select: {
          id: true, status: true, attempts: true, lastError: true,
          createdAt: true, updatedAt: true,
          event: { select: { id: true, sourceEventId: true, eventType: true,
            title: true, occurredAt: true, receivedAt: true, verified: true } },
        },
      }),
      prisma.safetyMchsQueueItem.count(),
      prisma.safetyMchsQueueItem.count({where:{status:'OBSERVED'}}),
      prisma.safetyMchsQueueItem.count({where:{status:'ANALYZED'}}),
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({ total, pending, analyzed, items, dispatchEnabled: false, playbackEnabled: false,
      queuePurpose: 'OBSERVATION_ONLY' });
  } catch (error) { next(error); }
});

/** Chronological assessment, read-only; never serves as an official all-clear. */
/** Immutable ingest history, read-only: never represents alert confirmation. */
router.get('/observation-queue/:queueId/history', canView, async (req,res,next)=>{
 try {
  const rows=await prisma.safetyMchsQueueHistory.findMany({
   where:{queueId:req.params.queueId},orderBy:[{createdAt:'asc'},{id:'asc'}],take:100,
   select:{id:true,status:true,reason:true,createdAt:true}
  });
  res.set('Cache-Control','no-store');
  res.json({items:rows,playbackEnabled:false,officialState:'UNKNOWN'});
 }catch(error){next(error);}
});
/** Admin-triggered diagnostic processing: never dispatches or verifies alerts. */
router.post('/observation-queue/analyze', requireRole('ADMIN'), async (req,res,next)=>{
 try {
  if (Object.keys(req.body||{}).length) return res.status(400).json({error:'NO_ARGUMENTS_ALLOWED'});
  const result=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581423)`;
   const items=await tx.safetyMchsQueueItem.findMany({
    where:{status:'OBSERVED'},orderBy:[{createdAt:'asc'},{id:'asc'}],take:50,
    select:{id:true,event:{select:{title:true,body:true,occurredAt:true}}}
   });
   const counts={};
   for(const item of items){
    const outcome=assessMchsQueueObservation(item.event);
    await tx.safetyMchsQueueItem.update({where:{id:item.id,status:'OBSERVED'},
      data:{status:'ANALYZED'}});
    await tx.safetyMchsQueueHistory.upsert({
      where:{queueId_status_reason:{queueId:item.id,status:'ANALYZED',reason:outcome.reason}},
      create:{queueId:item.id,status:'ANALYZED',reason:outcome.reason},update:{}
    });
    counts[outcome.reason]=(counts[outcome.reason]||0)+1;
   }
   return {processed:items.length,reasons:counts};
  },{timeout:15000});
  res.set('Cache-Control','no-store');
  res.json({...result,status:'ANALYZED',officialVerified:false,playbackEnabled:false,
   note:'Diagnostic observation review only'});
 }catch(error){next(error);}
});

router.get('/observation-order', canView, async (_req, res, next) => {
  try {
    const events = await prisma.safetyMchsEvent.findMany({
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }], take: 200,
      select: { id: true, source: true, sourceEventId: true,
        occurredAt: true, receivedAt: true, title: true, body: true },
    });
    const observations=inspectMchsObservationOrder(events);
    res.set('Cache-Control', 'no-store');
    res.json({ observations, assessedCount:observations.length, officialState:'UNKNOWN',
      authoritative:false, playbackEnabled:false, scope:'LATEST_200_OBSERVATIONS' });
  } catch(error) { next(error); }
});

router.put('/config', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const config = sanitize(req.body);
    if (!config) return res.status(400).json({ error: 'Недопустимые настройки: реальная активация недоступна на этапе 1' });
    await prisma.$transaction(async (tx) => {
      await tx.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(config) }, update: { value: JSON.stringify(config) } });
      const history = await tx.setting.findUnique({ where: { key: auditKey } });
      let entries = [];
      try { entries = JSON.parse(history?.value || '[]'); } catch {}
      if (!Array.isArray(entries)) entries = [];
      entries.push({ at: new Date().toISOString(), actorId: req.user.id, action: 'CONFIG_UPDATE', destinations: config.destinations, region: config.region });
      await tx.setting.upsert({ where: { key: auditKey }, create: { key: auditKey, value: JSON.stringify(entries.slice(-100)) }, update: { value: JSON.stringify(entries.slice(-100)) } });
    });
    res.json({ config });
  } catch (error) { next(error); }
});
export default router;
