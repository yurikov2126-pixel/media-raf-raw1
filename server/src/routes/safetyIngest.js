import { Router } from 'express';
import crypto from 'node:crypto';
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { classifyMchsObservation } from '../lib/mchsClassification.js';

// Dedicated machine-to-machine route. Never accepts user JWT or triggers any playback.
// Disabled by default, even after deployment.
const router = Router();
router.use(express.raw({ type: 'application/json', limit: '16kb' }));
const fail = (res, status, code) => res.status(status).json({ error: code });
async function signedRequest(req, res, next) {
  try {
    const key = process.env.MCHS_INGEST_HMAC_KEY || '';
    if (process.env.MCHS_INGEST_ENABLED !== 'true' || key.length < 32) return fail(res, 503, 'INGEST_DISABLED');
    const stamp = req.get('X-MCHS-Timestamp') || '';
    const signature = req.get('X-MCHS-Signature') || '';
    if (!/^\d{10,13}$/.test(stamp) || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return fail(res, 401, 'UNAUTHORIZED');
    const ts = Number(stamp);
    const ms = stamp.length === 10 ? ts * 1000 : ts;
    if (!Number.isSafeInteger(ms) || Math.abs(Date.now() - ms) > 120000) return fail(res, 401, 'STALE_REQUEST');
    if (!Buffer.isBuffer(req.body)) return fail(res, 415, 'JSON_REQUIRED');
    const signed = Buffer.concat([Buffer.from(stamp + '.', 'utf8'), req.body]);
    const expected = crypto.createHmac('sha256', key).update(signed).digest();
    const provided = Buffer.from(signature.slice(7), 'hex');
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return fail(res, 401, 'UNAUTHORIZED');
    let input;
    try { input = JSON.parse(req.body.toString('utf8')); } catch { return fail(res, 400, 'INVALID_JSON'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return fail(res, 400, 'INVALID_BODY');
    req.safetyInput = input;
    return next();
  } catch (error) { next(error); }
}
router.post('/event', signedRequest, async (req, res, next) => {
  try {
    const input = req.safetyInput;
    const { eventId, title, body, channelId, occurredAt, region } = input;
    if (typeof eventId !== 'string' || !/^[a-zA-Z0-9._:-]{1,160}$/.test(eventId) ||
      typeof title !== 'string' || title.length < 1 || title.length > 300 ||
      typeof body !== 'string' || body.length > 4000 ||
      (channelId != null && (typeof channelId !== 'string' || channelId.length > 100)) ||
      (region != null && (typeof region !== 'string' || region.length > 120))) return fail(res, 400, 'INVALID_BODY');
    let eventTime = null;
    if (occurredAt != null) {
      if (typeof occurredAt !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(occurredAt)) return fail(res, 400, 'INVALID_TIME');
      eventTime = new Date(occurredAt);
      if (!Number.isFinite(eventTime.getTime())) return fail(res, 400, 'INVALID_TIME');
    }
    const result = await prisma.safetyMchsEvent.upsert({
      where: { source_sourceEventId: { source: 'MCHS_ANDROID', sourceEventId: eventId } },
      create: { source: 'MCHS_ANDROID', sourceEventId: eventId, occurredAt: eventTime,
        title, body, channelId: channelId || null, region: region || null,
        eventType: classifyMchsObservation(title, body), verified: false },
      update: {},
      select: { id: true, receivedAt: true, verified: true }
    });
    res.status(200).json({ accepted: true, eventId, id: result.id, receivedAt: result.receivedAt, verified: false, testOnly: true });
  } catch (error) { next(error); }
});
router.post('/heartbeat', signedRequest, async (req, res, next) => {
  try {
    const { source, listener, push } = req.safetyInput;
    if (source !== 'mchs-android' || !['CONNECTED','DISCONNECTED','UNKNOWN'].includes(listener) ||
      !['REGISTERED','ERROR','UNKNOWN'].includes(push)) {
      return fail(res, 400, 'INVALID_BODY');
    }
    const health = await prisma.safetyMchsHealth.upsert({
      where: { id: 'mchs-android' },
      create: { id: 'mchs-android', lastSeenAt: new Date(), listener, push },
      update: { lastSeenAt: new Date(), listener, push },
      select: { lastSeenAt: true, listener: true, push: true }
    });
    res.set('Cache-Control', 'no-store');
    return res.json({ received: true, lastSeenAt: health.lastSeenAt, testOnly: true });
  } catch (error) { next(error); }
});

/**
 * Synthetic-only diagnostics. Separate key, separate storage, separate flag.
 * Does not read real notification records and cannot trigger playout.
 */
router.post('/diagnostic', async (req, res, next) => {
  try {
    const key = process.env.MCHS_DIAGNOSTIC_HMAC_KEY || '';
    if (process.env.MCHS_DIAGNOSTIC_ENABLED !== 'true' || key.length < 32) {
      return fail(res, 503, 'DIAGNOSTIC_DISABLED');
    }
    const stamp = req.get('X-MCHS-Timestamp') || '';
    const signature = req.get('X-MCHS-Signature') || '';
    if (!/^\d{10}$/.test(stamp) || !/^sha256=[a-f0-9]{64}$/i.test(signature) || !Buffer.isBuffer(req.body)) {
      return fail(res, 401, 'UNAUTHORIZED');
    }
    if (Math.abs(Date.now() - Number(stamp) * 1000) > 120000) return fail(res, 401, 'STALE_REQUEST');
    const expected = crypto.createHmac('sha256', key)
      .update(Buffer.concat([Buffer.from(stamp + '.', 'utf8'), req.body])).digest();
    const received = Buffer.from(signature.slice(7), 'hex');
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      return fail(res, 401, 'UNAUTHORIZED');
    }
    let input;
    try { input = JSON.parse(req.body.toString('utf8')); } catch { return fail(res, 400, 'INVALID_JSON'); }
    if (!input || Array.isArray(input) || typeof input !== 'object' ||
      input.testOnly !== true ||
      typeof input.eventId !== 'string' || !/^diagnostic-[a-z0-9-]{8,120}$/.test(input.eventId) ||
      input.title !== 'ТЕСТ: диагностика приёмника' ||
      input.body !== 'Искусственная проверка записи журнала. Не является предупреждением или оповещением.' ||
      Object.keys(input).some(k => !['eventId', 'title', 'body', 'testOnly'].includes(k))) {
      return fail(res, 400, 'SYNTHETIC_ONLY');
    }
    const row = await prisma.safetyMchsDiagnostic.upsert({
      where: { eventId: input.eventId },
      create: { eventId: input.eventId },
      update: {},
      select: { id: true, receivedAt: true },
    });
    res.set('Cache-Control', 'no-store');
    return res.json({ accepted: true, eventId: input.eventId, id: row.id,
      receivedAt: row.receivedAt, testOnly: true, verified: false });
  } catch (error) { next(error); }
});

export default router;
