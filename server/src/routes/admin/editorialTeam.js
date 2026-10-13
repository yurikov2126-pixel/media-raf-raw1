import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

const router = Router();
const POSITIONS = [
  { code: 'EDITOR_IN_CHIEF', label: 'Главный редактор' },
  { code: 'PHOTO_EDITOR', label: 'Фоторедактор' },
  { code: 'VIDEO_EDITOR', label: 'Видеоредактор' },
  { code: 'REPORTER', label: 'Корреспондент' },
  { code: 'DESIGNER', label: 'Дизайнер' },
  { code: 'PRODUCER', label: 'Продюсер' },
  { code: 'CURATOR', label: 'Куратор редакции' },
];
const types = ['STUDENT', 'MENTOR'];
const safeUser = { id: true, fullName: true, username: true, role: true, avatar: true, isBanned: true };

router.get('/editorial-team', async (_req, res, next) => {
  try {
    const [members, users] = await Promise.all([
      prisma.editorialTeamMember.findMany({
        include: { user: { select: safeUser } },
        orderBy: [{ memberType: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.user.findMany({ where: { isBanned: false }, select: safeUser, orderBy: { fullName: 'asc' }, take: 1000 }),
    ]);
    res.json({ members, users, positions: POSITIONS, types });
  } catch (e) { next(e); }
});

router.put('/editorial-team/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { memberType, position } = req.body || {};
    if (!types.includes(memberType) || !POSITIONS.some(p => p.code === position))
      return res.status(400).json({ error: 'Некорректный тип участника или редакционная роль' });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: safeUser });
    if (!user || user.isBanned) return res.status(404).json({ error: 'Пользователь не найден или заблокирован' });
    const member = await prisma.$transaction(async tx => {
      const row = await tx.editorialTeamMember.upsert({
        where: { userId },
        create: { userId, memberType, position },
        update: { memberType, position },
        include: { user: { select: safeUser } },
      });
      await tx.adminAction.create({ data: {
        adminId: req.user.id, action: 'editorial_team_assign',
        payload: JSON.stringify({ userId, memberType, position }), affected: 1,
      } });
      return row;
    });
    res.json({ member });
  } catch (e) { next(e); }
});

router.delete('/editorial-team/:userId', async (req, res, next) => {
  try {
    const count = await prisma.$transaction(async tx => {
      const { count } = await tx.editorialTeamMember.deleteMany({ where: { userId: req.params.userId } });
      if (count) await tx.adminAction.create({ data: {
        adminId: req.user.id, action: 'editorial_team_remove',
        payload: JSON.stringify({ userId: req.params.userId }), affected: count,
      } });
      return count;
    });
    if (!count) return res.status(404).json({ error: 'Участник редакции не найден' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
export default router;
