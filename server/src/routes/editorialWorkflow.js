import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(auth);
const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'REVISION', 'APPROVED', 'DONE'];
const isAdmin = (user) => user.role === 'ADMIN';
const memberRole = (project, user) => project.members.find((member) => member.userId === user.id)?.role;
const canEdit = (project, user) => isAdmin(user) || ['MANAGER', 'EDITOR'].includes(memberRole(project, user));
const canSee = (project, user) => isAdmin(user) || !!memberRole(project, user);
async function getProject(id) {
    return prisma.editorialProject.findUnique({ where: { id }, include: { members: true } });
}
function notFound(res) { return res.status(404).json({ error: 'Проект не найден' }); }
function validText(value, max) { return typeof value === 'string' && !!value.trim() && value.trim().length <= max; }
function dateValue(value) {
    if (value === null || value === '') return null;
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

router.get('/people', async (req, res, next) => {
    try {
        if (!['ADMIN', 'MENTOR'].includes(req.user.role) &&
            !(await prisma.editorialProjectMember.count({ where: { userId: req.user.id, role: 'MANAGER' } }))) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
        if (q.length < 2) return res.json({ people: [] });
        const people = await prisma.user.findMany({
            where: { isBanned: false, OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { username: { contains: q, mode: 'insensitive' } }] },
            select: { id: true, fullName: true, username: true, avatar: true },
            take: 12,
            orderBy: { fullName: 'asc' },
        });
        res.json({ people });
    } catch (error) { next(error); }
});

router.get('/projects/:projectId/workflow', async (req, res, next) => {
    try {
        const project = await getProject(req.params.projectId);
        if (!project || !canSee(project, req.user)) return notFound(res);
        const [stages, tasks] = await Promise.all([
            prisma.editorialStage.findMany({ where: { projectId: project.id }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
            prisma.editorialTask.findMany({ where: { projectId: project.id }, include: { dependencies: { select: { dependsOnId: true } }, assignee: { select: { id: true, fullName: true, username: true } } }, orderBy: { createdAt: 'asc' } }),
        ]);
        res.json({ stages, tasks });
    } catch (error) { next(error); }
});

router.post('/projects/:projectId/stages', async (req, res, next) => {
    try {
        const project = await getProject(req.params.projectId);
        if (!project || !canEdit(project, req.user)) return notFound(res);
        if (!validText(req.body.title, 100)) return res.status(400).json({ error: 'Название этапа должно быть от 1 до 100 символов' });
        const stage = await prisma.editorialStage.create({ data: { projectId: project.id, title: req.body.title.trim(), position: await prisma.editorialStage.count({ where: { projectId: project.id } }) } });
        res.status(201).json({ stage });
    } catch (error) { next(error); }
});

router.post('/projects/:projectId/tasks', async (req, res, next) => {
    try {
        const project = await getProject(req.params.projectId);
        if (!project || !canEdit(project, req.user)) return notFound(res);
        const { title, description = '', stageId = null, parentId = null, assigneeId = null, dueAt = null } = req.body;
        if (!validText(title, 160) || typeof description !== 'string' || description.length > 10000) return res.status(400).json({ error: 'Некорректное название или описание' });
        if (stageId && !(await prisma.editorialStage.findFirst({ where: { id: stageId, projectId: project.id } }))) return res.status(400).json({ error: 'Этап не найден' });
        if (parentId && !(await prisma.editorialTask.findFirst({ where: { id: parentId, projectId: project.id } }))) return res.status(400).json({ error: 'Родительская задача не найдена' });
        if (assigneeId && !project.members.some((m) => m.userId === assigneeId)) return res.status(400).json({ error: 'Исполнитель должен быть участником проекта' });
        const due = dateValue(dueAt);
        if (due === undefined) return res.status(400).json({ error: 'Некорректный срок' });
        const task = await prisma.editorialTask.create({ data: { projectId: project.id, title: title.trim(), description, stageId, parentId, assigneeId, dueAt: due, createdById: req.user.id } });
        res.status(201).json({ task });
    } catch (error) { next(error); }
});

router.patch('/projects/:projectId/tasks/:taskId', async (req, res, next) => {
    try {
        const project = await getProject(req.params.projectId);
        if (!project || !canSee(project, req.user)) return notFound(res);
        const task = await prisma.editorialTask.findFirst({ where: { id: req.params.taskId, projectId: project.id } });
        if (!task) return res.status(404).json({ error: 'Задача не найдена' });
        const editor = canEdit(project, req.user);
        if (!editor && task.assigneeId !== req.user.id) return res.status(403).json({ error: 'Нет прав на изменение задачи' });
        const data = {};
        if (req.body.status !== undefined) {
            if (!STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Некорректный статус' });
            if (!editor && !['IN_PROGRESS', 'IN_REVIEW', 'REVISION'].includes(req.body.status)) return res.status(403).json({ error: 'Утверждать задачи может только редактор' });
            data.status = req.body.status;
        }
        if (editor) {
            if (req.body.title !== undefined) {
                if (!validText(req.body.title, 160)) return res.status(400).json({ error: 'Некорректное название' });
                data.title = req.body.title.trim();
            }
            if (req.body.description !== undefined) {
                if (typeof req.body.description !== 'string' || req.body.description.length > 10000) return res.status(400).json({ error: 'Некорректное описание' });
                data.description = req.body.description;
            }
            if (req.body.assigneeId !== undefined) {
                if (req.body.assigneeId !== null && !project.members.some((m) => m.userId === req.body.assigneeId)) return res.status(400).json({ error: 'Исполнитель должен быть участником проекта' });
                data.assigneeId = req.body.assigneeId;
            }
            if (req.body.stageId !== undefined) {
                if (req.body.stageId !== null && !(await prisma.editorialStage.findFirst({ where: { id: req.body.stageId, projectId: project.id } }))) return res.status(400).json({ error: 'Этап не найден' });
                data.stageId = req.body.stageId;
            }
            if (req.body.dueAt !== undefined) {
                const due = dateValue(req.body.dueAt);
                if (due === undefined) return res.status(400).json({ error: 'Некорректный срок' });
                data.dueAt = due;
            }
            if (req.body.parentId !== undefined) {
                const parentId = req.body.parentId;
                if (parentId === task.id) return res.status(400).json({ error: 'Задача не может быть собственной подзадачей' });
                if (parentId !== null) {
                    const parent = await prisma.editorialTask.findFirst({ where: { id: parentId, projectId: project.id } });
                    if (!parent) return res.status(400).json({ error: 'Родительская задача не найдена' });
                    let cursor = parent;
                    while (cursor?.parentId) {
                        if (cursor.parentId === task.id) return res.status(400).json({ error: 'Обнаружен цикл подзадач' });
                        cursor = await prisma.editorialTask.findUnique({ where: { id: cursor.parentId } });
                    }
                }
                data.parentId = parentId;
            }
        } else if (Object.keys(req.body).some((key) => key !== 'status')) {
            return res.status(403).json({ error: 'Исполнитель может менять только статус' });
        }
        if (!Object.keys(data).length) return res.status(400).json({ error: 'Нет изменений' });
        const updated = await prisma.editorialTask.update({ where: { id: task.id }, data });
        res.json({ task: updated });
    } catch (error) { next(error); }
});

router.post('/projects/:projectId/tasks/:taskId/dependencies', async (req, res, next) => {
    try {
        const project = await getProject(req.params.projectId);
        if (!project || !canEdit(project, req.user)) return notFound(res);
        const taskId = req.params.taskId, dependsOnId = req.body.dependsOnId;
        if (typeof dependsOnId !== 'string' || dependsOnId === taskId) return res.status(400).json({ error: 'Недопустимая зависимость' });
        const tasks = await prisma.editorialTask.findMany({ where: { projectId: project.id, id: { in: [taskId, dependsOnId] } }, select: { id: true } });
        if (tasks.length !== 2) return res.status(404).json({ error: 'Задача не найдена' });
        const links = await prisma.editorialTaskDependency.findMany({ where: { task: { projectId: project.id } } });
        const edges = new Map();
        for (const link of links) edges.set(link.taskId, [...(edges.get(link.taskId) || []), link.dependsOnId]);
        const seen = new Set(), stack = [dependsOnId];
        while (stack.length) {
            const id = stack.pop();
            if (id === taskId) return res.status(400).json({ error: 'Циклическая зависимость запрещена' });
            if (seen.has(id)) continue;
            seen.add(id); stack.push(...(edges.get(id) || []));
        }
        await prisma.editorialTaskDependency.upsert({ where: { taskId_dependsOnId: { taskId, dependsOnId } }, create: { taskId, dependsOnId }, update: {} });
        res.status(201).json({ ok: true });
    } catch (error) { next(error); }
});

router.delete('/projects/:projectId/tasks/:taskId/dependencies/:dependsOnId', async (req, res, next) => {
    try {
        const project = await getProject(req.params.projectId);
        if (!project || !canEdit(project, req.user)) return notFound(res);
        const result = await prisma.editorialTaskDependency.deleteMany({ where: { taskId: req.params.taskId, dependsOnId: req.params.dependsOnId, task: { projectId: project.id }, dependsOn: { projectId: project.id } } });
        res.json({ removed: result.count });
    } catch (error) { next(error); }
});

export default router;
