import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { getEditorialPositions, saveEditorialPositions, validPositionCode } from '../../lib/editorialPositions.js';

const router = Router();
const safeUser = { id: true, fullName: true, username: true, role: true, avatar: true, isBanned: true };

router.get('/editorial-team', async (_req, res, next) => {
  try {
    const [members, users, positions] = await Promise.all([
      prisma.editorialTeamMember.findMany({ include: { user: { select: safeUser } } }),
      prisma.user.findMany({ where: { isBanned: false }, select: safeUser, orderBy: { fullName: 'asc' } }),
      getEditorialPositions(),
    ]);
    const assignments = new Map(members.map(m => [m.userId, m]));
    res.json({
      members: users.map(user => ({ userId: user.id, user, position: assignments.get(user.id)?.position || null })),
      positions,
    });
  } catch (e) { next(e); }
});

router.put('/editorial-team/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const position = req.body?.position;
    const positions = await getEditorialPositions();
    if (position !== null && !positions.some(p => p.code === position))
      return res.status(400).json({ error: 'Некорректная редакционная должность' });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: safeUser });
    if (!user || user.isBanned) return res.status(404).json({ error: 'Пользователь не найден или заблокирован' });
    const result = await prisma.$transaction(async tx => {
      if (position === null) {
        await tx.editorialTeamMember.deleteMany({ where: { userId } });
      } else {
        await tx.editorialTeamMember.upsert({
          where: { userId }, create: { userId, memberType: user.role === 'MENTOR' || user.role === 'ADMIN' ? 'MENTOR' : 'STUDENT', position },
          update: { position },
        });
      }
      await tx.adminAction.create({ data: { adminId: req.user.id, action: 'editorial_position_assign', payload: JSON.stringify({ userId, position }), affected: 1 } });
      return { userId, user, position };
    });
    res.json({ member: result });
  } catch (e) { next(e); }
});

router.get('/editorial-positions', async (_req, res, next) => {
  try { res.json({ positions: await getEditorialPositions() }); } catch(e) { next(e); }
});
router.post('/editorial-positions', async (req, res, next) => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
    const label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
    if (!validPositionCode(code) || !label || label.length > 80) return res.status(400).json({ error: 'Проверьте код и название должности' });
    const positions = await getEditorialPositions();
    if (positions.some(p => p.code === code)) return res.status(409).json({ error: 'Код уже существует' });
    const updated = [...positions, { code, label }];
    await saveEditorialPositions(updated);
    await prisma.adminAction.create({ data: { adminId: req.user.id, action: 'editorial_position_create', payload: JSON.stringify({ code, label }), affected: 1 } });
    res.status(201).json({ positions: updated });
  } catch(e) { next(e); }
});
router.patch('/editorial-positions/:code', async (req, res, next) => {
  try {
    const label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
    if (!label || label.length > 80) return res.status(400).json({ error: 'Название: 1–80 символов' });
    const positions = await getEditorialPositions();
    if (!positions.some(p => p.code === req.params.code)) return res.status(404).json({ error: 'Должность не найдена' });
    const updated = positions.map(p => p.code === req.params.code ? { ...p, label } : p);
    await saveEditorialPositions(updated);
    await prisma.adminAction.create({ data: { adminId: req.user.id, action: 'editorial_position_rename', payload: JSON.stringify({ code: req.params.code, label }), affected: 1 } });
    res.json({ positions: updated });
  } catch(e) { next(e); }
});
router.delete('/editorial-positions/:code', async (req, res, next) => {
  try {
    const code = req.params.code;
    const positions = await getEditorialPositions();
    if (!positions.some(p => p.code === code)) return res.status(404).json({ error: 'Должность не найдена' });
    const [teamCount, projectCount] = await Promise.all([
      prisma.editorialTeamMember.count({ where: { position: code } }),
      prisma.editorialProjectMember.count({ where: { crewPosition: code } }),
    ]);
    if (teamCount || projectCount) return res.status(409).json({ error: 'Должность используется. Сначала переназначьте сотрудников и участников проектов.' });
    const updated = positions.filter(p => p.code !== code);
    await saveEditorialPositions(updated);
    await prisma.adminAction.create({ data: { adminId: req.user.id, action: 'editorial_position_delete', payload: JSON.stringify({ code }), affected: 1 } });
    res.json({ positions: updated });
  } catch(e) { next(e); }
});
export default router;
