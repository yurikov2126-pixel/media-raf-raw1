import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { BUILTIN_ROLES, PERMISSIONS, ROLE_SETTINGS_KEY, cleanPermissions, getRoles, validCode } from '../../lib/roles.js';

const router = Router();
const extra = async (tx = prisma) => {
  const row = await tx.setting.findUnique({ where: { key: ROLE_SETTINGS_KEY } });
  try { return JSON.parse(row?.value || '{}'); } catch { return {}; }
};
const fail = (res, message, status = 400) => res.status(status).json({ error: message });
const label = value => typeof value === 'string' ? value.trim() : '';
const audit = (tx, adminId, action, payload) => tx.adminAction.create({
  data: { adminId, action, payload: JSON.stringify(payload), affected: 1 },
});

router.get('/roles', async (_req, res, next) => {
  try {
    const roles = await getRoles();
    const counts = await prisma.user.groupBy({ by: ['role'], _count: { id: true } });
    const byRole = Object.fromEntries(counts.map(r => [r.role, r._count.id]));
    res.json({ roles: Object.entries(roles).map(([code, role]) => ({ code, ...role, count: byRole[code] || 0 })), permissions: PERMISSIONS });
  } catch (e) { next(e); }
});

router.post('/roles', async (req, res, next) => {
  const code = label(req.body?.code).toUpperCase();
  const name = label(req.body?.name);
  const description = label(req.body?.description);
  const permissions = cleanPermissions(req.body?.permissions ?? []);
  if (!validCode(code) || !name || name.length > 60 || description.length > 240 || !permissions) return fail(res, 'Проверьте код, название, описание и разрешения');
  if (code in BUILTIN_ROLES) return fail(res, 'Системная роль защищена', 409);
  try {
    const result = await prisma.$transaction(async tx => {
      const custom = await extra(tx);
      if (custom[code]) return null;
      custom[code] = { name, description, builtin: false, permissions };
      await tx.setting.upsert({ where: { key: ROLE_SETTINGS_KEY }, create: { key: ROLE_SETTINGS_KEY, value: JSON.stringify(custom) }, update: { value: JSON.stringify(custom) } });
      await audit(tx, req.user.id, 'role_create', { code, permissions });
      return custom[code];
    });
    if (!result) return fail(res, 'Такая роль уже существует', 409);
    res.status(201).json({ code, ...result });
  } catch (e) { next(e); }
});

router.patch('/roles/:code', async (req, res, next) => {
  const code = req.params.code;
  if (code in BUILTIN_ROLES) return fail(res, 'Системные роли нельзя изменять: их права пока закреплены в коде', 403);
  const name = label(req.body?.name);
  const description = label(req.body?.description);
  const permissions = cleanPermissions(req.body?.permissions);
  if (!name || name.length > 60 || description.length > 240 || !permissions) return fail(res, 'Некорректные данные');
  try {
    const updated = await prisma.$transaction(async tx => {
      const custom = await extra(tx);
      if (!custom[code]) return null;
      custom[code] = { name, description, permissions, builtin: false };
      await tx.setting.upsert({ where: { key: ROLE_SETTINGS_KEY }, create: { key: ROLE_SETTINGS_KEY, value: JSON.stringify(custom) }, update: { value: JSON.stringify(custom) } });
      await audit(tx, req.user.id, 'role_update', { code, permissions });
      return custom[code];
    });
    if (!updated) return fail(res, 'Роль не найдена', 404);
    res.json({ code, ...updated });
  } catch (e) { next(e); }
});

router.delete('/roles/:code', async (req, res, next) => {
  const code = req.params.code;
  if (code in BUILTIN_ROLES) return fail(res, 'Системную роль удалять нельзя', 403);
  try {
    const result = await prisma.$transaction(async tx => {
      const custom = await extra(tx);
      if (!custom[code]) return 'missing';
      const count = await tx.user.count({ where: { role: code } });
      if (count) return 'assigned';
      delete custom[code];
      await tx.setting.upsert({ where: { key: ROLE_SETTINGS_KEY }, create: { key: ROLE_SETTINGS_KEY, value: JSON.stringify(custom) }, update: { value: JSON.stringify(custom) } });
      await audit(tx, req.user.id, 'role_delete', { code });
      return 'deleted';
    });
    if (result === 'missing') return fail(res, 'Роль не найдена', 404);
    if (result === 'assigned') return fail(res, 'Сначала переназначьте пользователей этой роли', 409);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
export default router;
