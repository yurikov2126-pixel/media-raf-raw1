import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { hasPermission } from '../lib/roles.js';

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
    const [events, count, health] = await Promise.all([
      prisma.safetyMchsEvent.findMany({ orderBy: { receivedAt: 'desc' }, take: 50, select: {
        id: true, source: true, receivedAt: true, occurredAt: true, title: true,
        body: true, channelId: true, region: true, eventType: true, verified: true,
      } }),
      prisma.safetyMchsEvent.count(),
      prisma.safetyMchsHealth.findUnique({ where: { id: 'mchs-android' } }),
    ]);
    res.json({
      config,
      source: { name: 'МЧС России / Android', connection: 'NOT_CONFIGURED', lastSeen: health?.lastSeenAt || null, listener: health?.listener || 'UNVERIFIED', push: health?.push || 'UNVERIFIED' },
      integration: { status: 'DISABLED', receiverConfigured: false, deliveryVerified: false },
      events,
      eventCount: count,
      eventHistoryAvailable: true,
      liveActivationAvailable: false,
      message: 'Приём событий Android пока не подключён. Пустой журнал не означает отсутствия предупреждений МЧС.',
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
    res.json({ events, ingestionEnabled: false });
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
