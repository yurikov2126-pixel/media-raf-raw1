import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
const router = Router();
router.use(auth);
router.use((req,res,next) => req.user.role === 'ADMIN' ? next() : res.status(403).json({ error: 'Доступ только администратору' }));
router.get('/', async (_req,res,next) => {
  try {
    const [setting, seasons] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'gamification_seasons_enabled' } }),
      prisma.gamificationSeason.findMany({ orderBy: { startsAt: 'asc' } })
    ]);
    res.json({ enabled: setting?.value !== 'false', seasons });
  } catch(e) { next(e); }
});
router.put('/enabled', async (req,res,next) => {
  try {
    if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ error: 'Нужно логическое значение enabled' });
    await prisma.setting.upsert({ where: { key: 'gamification_seasons_enabled' }, create: { key: 'gamification_seasons_enabled', value: String(req.body.enabled) }, update: { value: String(req.body.enabled) } });
    res.json({ enabled: req.body.enabled });
  } catch(e) { next(e); }
});
const fields = body => {
  const title = String(body.title ?? '').trim();
  const slug = String(body.slug ?? '').trim();
  const description = String(body.description ?? '');
  const rules = String(body.rules ?? '');
  const rewards = String(body.rewards ?? '');
  const startsAt = new Date(body.startsAt), endsAt = new Date(body.endsAt);
  if (!title || title.length > 100 || !/^[a-z0-9-]{3,60}$/.test(slug) || description.length > 2000 || rules.length > 10000 || rewards.length > 5000 || !Number.isFinite(+startsAt) || !Number.isFinite(+endsAt) || startsAt >= endsAt || typeof body.enabled !== 'boolean') return null;
  return { title, slug, description, rules, rewards, startsAt, endsAt, enabled: body.enabled };
};
async function overlaps(data, excludeId) {
  return prisma.gamificationSeason.count({ where: { ...(excludeId ? { id: { not: excludeId } } : {}), startsAt: { lt: data.endsAt }, endsAt: { gt: data.startsAt } } });
}
router.post('/', async (req,res,next) => {
  try {
    const data = fields(req.body || {});
    if (!data) return res.status(400).json({ error: 'Проверьте поля и даты сезона' });
    if (await overlaps(data)) return res.status(409).json({ error: 'Даты пересекаются с другим сезоном' });
    const season = await prisma.gamificationSeason.create({ data });
    res.status(201).json({ season });
  } catch(e) { next(e); }
});
router.put('/:id', async (req,res,next) => {
  try {
    const data = fields(req.body || {});
    if (!data) return res.status(400).json({ error: 'Проверьте поля и даты сезона' });
    const current = await prisma.gamificationSeason.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'Сезон не найден' });
    if (await overlaps(data, current.id)) return res.status(409).json({ error: 'Даты пересекаются с другим сезоном' });
    const season = await prisma.gamificationSeason.update({ where: { id: current.id }, data });
    res.json({ season });
  } catch(e) { next(e); }
});
export default router;
