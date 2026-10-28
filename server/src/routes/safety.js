import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { hasPermission } from '../lib/roles.js';
import { classifyMchsObservation, MCHS_EVENT_TYPES } from '../lib/mchsClassification.js';

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
