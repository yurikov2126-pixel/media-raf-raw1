import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(auth);

router.get('/', async (_req, res) => {
  try {
    const now = new Date();
    const seasons = await prisma.gamificationSeason.findMany({ orderBy: { startsAt: 'asc' } });
    res.json({ seasons: seasons.map(s => ({
      ...s, status: now < s.startsAt ? 'upcoming' : now >= s.endsAt ? 'finished' : 'active'
    })) });
  } catch (error) { res.status(500).json({ error: 'Не удалось загрузить сезоны' }); }
});

router.get('/:slug/leaderboard', async (req, res) => {
  try {
    const season = await prisma.gamificationSeason.findUnique({ where: { slug: req.params.slug } });
    if (!season) return res.status(404).json({ error: 'Сезон не найден' });
    const now = new Date();
    const until = now < season.endsAt ? now : season.endsAt;
    const grouped = await prisma.xpLog.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: season.startsAt, lt: until } },
      _sum: { amount: true }
    });
    const ids = grouped.map(r => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: ids }, isBanned: false },
      select: { id: true, username: true, fullName: true, avatar: true }
    });
    const byId = new Map(users.map(u => [u.id, u]));
    const items = grouped.filter(r => byId.has(r.userId)).map(r => ({
      ...byId.get(r.userId), xp: Math.max(0, r._sum.amount || 0)
    })).sort((a,b) => b.xp - a.xp || a.username.localeCompare(b.username)).slice(0,100);
    res.json({ season, items, scoring: 'xp_log' });
  } catch (error) { res.status(500).json({ error: 'Не удалось загрузить рейтинг сезона' }); }
});

export default router;
