import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(auth);
const ROLES = ['MANAGER', 'EDITOR', 'PARTICIPANT', 'OBSERVER'];
const isAdmin = (user) => user.role === 'ADMIN';
const canManage = (project, user) => isAdmin(user) || project.members.some((m) => m.userId === user.id && m.role === 'MANAGER');
const clean = (project) => ({ ...project, members: project.members.map((m) => ({ ...m, user: m.user ? { id: m.user.id, fullName: m.user.fullName, username: m.user.username } : undefined })) });

router.get('/projects', async (req, res, next) => {
    try {
        const projects = await prisma.editorialProject.findMany({
            where: isAdmin(req.user) ? {} : { OR: [{ visibility: 'TEAM' }, { members: { some: { userId: req.user.id } } }] },
            include: { members: { include: { user: { select: { id: true, fullName: true, username: true } } } } },
            orderBy: { updatedAt: 'desc' },
        });
        res.json({ projects: projects.map(clean) });
    } catch (error) { next(error); }
});

router.post('/projects', async (req, res, next) => {
    try {
        if (!['ADMIN', 'MENTOR'].includes(req.user.role)) return res.status(403).json({ error: 'Создавать проекты могут руководители' });
        const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
        const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
        const visibility = req.body.visibility === 'TEAM' ? 'TEAM' : 'CLOSED';
        if (!title || title.length > 120 || description.length > 5000) return res.status(400).json({ error: 'Проверьте название и описание' });
        const project = await prisma.editorialProject.create({
            data: { title, description, visibility, createdById: req.user.id, members: { create: { userId: req.user.id, role: 'MANAGER' } } },
            include: { members: { include: { user: { select: { id: true, fullName: true, username: true } } } } },
        });
        res.status(201).json({ project: clean(project) });
    } catch (error) { next(error); }
});

router.get('/projects/:id', async (req, res, next) => {
    try {
        const project = await prisma.editorialProject.findUnique({
            where: { id: req.params.id },
            include: { members: { include: { user: { select: { id: true, fullName: true, username: true } } } } },
        });
        if (!project || (!isAdmin(req.user) && project.visibility !== 'TEAM' && !project.members.some((m) => m.userId === req.user.id))) return res.status(404).json({ error: 'Проект не найден' });
        res.json({ project: clean(project) });
    } catch (error) { next(error); }
});

router.patch('/projects/:id', async (req, res, next) => {
    try {
        const project = await prisma.editorialProject.findUnique({ where: { id: req.params.id }, include: { members: true } });
        if (!project || !canManage(project, req.user)) return res.status(404).json({ error: 'Проект не найден' });
        const data = {};
        if (req.body.title !== undefined) {
            if (typeof req.body.title !== 'string' || !req.body.title.trim() || req.body.title.trim().length > 120) return res.status(400).json({ error: 'Некорректное название' });
            data.title = req.body.title.trim();
        }
        if (req.body.description !== undefined) {
            if (typeof req.body.description !== 'string' || req.body.description.length > 5000) return res.status(400).json({ error: 'Некорректное описание' });
            data.description = req.body.description.trim();
        }
        if (req.body.visibility !== undefined) {
            if (!['TEAM', 'CLOSED'].includes(req.body.visibility)) return res.status(400).json({ error: 'Некорректная видимость' });
            data.visibility = req.body.visibility;
        }
        const updated = await prisma.editorialProject.update({ where: { id: project.id }, data, include: { members: { include: { user: { select: { id: true, fullName: true, username: true } } } } } });
        res.json({ project: clean(updated) });
    } catch (error) { next(error); }
});

router.post('/projects/:id/members', async (req, res, next) => {
    try {
        const project = await prisma.editorialProject.findUnique({ where: { id: req.params.id }, include: { members: true } });
        if (!project || !canManage(project, req.user)) return res.status(404).json({ error: 'Проект не найден' });
        const { userId, role } = req.body;
        if (project.createdById === userId && role !== 'MANAGER') return res.status(400).json({ error: 'Создатель должен оставаться руководителем' });
        if (typeof userId !== 'string' || !ROLES.includes(role)) return res.status(400).json({ error: 'Некорректный участник или роль' });
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isBanned: true } });
        if (!user || user.isBanned) return res.status(404).json({ error: 'Пользователь не найден' });
        const member = await prisma.editorialProjectMember.upsert({
            where: { projectId_userId: { projectId: project.id, userId } },
            create: { projectId: project.id, userId, role },
            update: { role },
        });
        res.json({ member });
    } catch (error) { next(error); }
});

router.delete('/projects/:id/members/:userId', async (req, res, next) => {
    try {
        const project = await prisma.editorialProject.findUnique({ where: { id: req.params.id }, include: { members: true } });
        if (!project || !canManage(project, req.user)) return res.status(404).json({ error: 'Проект не найден' });
        if (project.createdById === req.params.userId) return res.status(400).json({ error: 'Нельзя удалить создателя проекта' });
        await prisma.editorialProjectMember.deleteMany({ where: { projectId: project.id, userId: req.params.userId } });
        res.json({ ok: true });
    } catch (error) { next(error); }
});

export default router;
