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

// Notifications share the existing site inbox; never send to non-members.
async function notifyEditorial(tx, project, task, recipients, event, actorId) {
    const allowed = new Set(project.members.map((member) => member.userId));
    const ids = [...new Set(recipients)].filter((id) => id && id !== actorId && allowed.has(id));
    if (!ids.length) return;
    await tx.notification.createMany({ data: ids.map((userId) => ({
        userId, type: 'editorial',
        payload: JSON.stringify({ projectId: project.id, projectTitle: project.title, taskId: task.id, taskTitle: task.title, event }),
    })) });
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
        const { title, description = '', stageId = null, parentId = null, assigneeId = null, dueAt = null, isOpen = false } = req.body;
        if (!validText(title, 160) || typeof description !== 'string' || description.length > 10000) return res.status(400).json({ error: 'Некорректное название или описание' });
        if (stageId && !(await prisma.editorialStage.findFirst({ where: { id: stageId, projectId: project.id } }))) return res.status(400).json({ error: 'Этап не найден' });
        if (parentId && !(await prisma.editorialTask.findFirst({ where: { id: parentId, projectId: project.id } }))) return res.status(400).json({ error: 'Родительская задача не найдена' });
        if (assigneeId && !project.members.some((m) => m.userId === assigneeId)) return res.status(400).json({ error: 'Исполнитель должен быть участником проекта' });
        const due = dateValue(dueAt);
        if (due === undefined) return res.status(400).json({ error: 'Некорректный срок' });
        if (typeof isOpen !== 'boolean') return res.status(400).json({ error: 'Некорректная настройка заявок' });
        const task = await prisma.editorialTask.create({ data: { projectId: project.id, title: title.trim(), description, stageId, parentId, assigneeId, dueAt: due, isOpen, createdById: req.user.id, events: { create: { actorId: req.user.id, action: 'CREATED' } } } });
        if (task.assigneeId) await notifyEditorial(prisma, project, task, [task.assigneeId], 'assigned', req.user.id);
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
            if (req.body.isOpen !== undefined) {
                if (typeof req.body.isOpen !== 'boolean') return res.status(400).json({ error: 'Некорректная настройка заявок' });
                data.isOpen = req.body.isOpen;
            }
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
        const updated = await prisma.$transaction(async (tx) => {
            const result = await tx.editorialTask.update({ where: { id: task.id }, data });
            await tx.editorialTaskEvent.create({ data: { taskId: task.id, actorId: req.user.id, action: 'UPDATED', details: JSON.stringify({ before: Object.fromEntries(Object.keys(data).map((key) => [key, task[key] instanceof Date ? task[key].toISOString() : task[key]])), after: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])) }) } });
            if (data.assigneeId && data.assigneeId !== task.assigneeId) await notifyEditorial(tx, project, result, [data.assigneeId], 'assigned', req.user.id);
            if (data.status && data.status !== task.status) await notifyEditorial(tx, project, result, [task.assigneeId, task.createdById], 'status', req.user.id);
            return result;
        });
        res.json({ task: updated });
    } catch (error) { next(error); }
});


router.post('/projects/:projectId/tasks/:taskId/review', async (req, res, next) => {
    try {
        const project = await getProject(req.params.projectId);
        if (!project || !canSee(project, req.user)) return notFound(res);
        const task = await prisma.editorialTask.findFirst({ where: { id: req.params.taskId, projectId: project.id } });
        if (!task) return res.status(404).json({ error: 'Задача не найдена' });
        const editor = canEdit(project, req.user);
        const action = req.body?.action;
        const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
        if (!['submit', 'approve', 'revise'].includes(action)) return res.status(400).json({ error: 'Неизвестное действие' });
        if (typeof req.body?.note !== 'string' || note.length > 10000) return res.status(400).json({ error: 'Некорректное замечание' });
        if (action === 'submit' && task.assigneeId !== req.user.id) return res.status(403).json({ error: 'Отправить материал может исполнитель' });
        if (action !== 'submit' && !editor) return res.status(403).json({ error: 'Проверять материалы может только редактор' });
        if (action === 'submit' && !['TODO', 'IN_PROGRESS', 'REVISION'].includes(task.status)) return res.status(409).json({ error: 'Материал нельзя отправить из текущего статуса' });
        if (action !== 'submit' && task.status !== 'IN_REVIEW') return res.status(409).json({ error: 'Материал не находится на проверке' });
        if (action === 'revise' && !note) return res.status(400).json({ error: 'Укажите, что необходимо исправить' });
        if (action === 'submit' && !(await prisma.editorialMaterialFile.count({ where: { taskId: task.id } }))) return res.status(400).json({ error: 'Сначала прикрепите материалы' });
        const status = action === 'submit' ? 'IN_REVIEW' : action === 'approve' ? 'APPROVED' : 'REVISION';
        const updated = await prisma.$transaction(async (tx) => {
            const result = await tx.editorialTask.update({ where: { id: task.id }, data: { status } });
            if (note) await tx.editorialTaskComment.create({ data: { taskId: task.id, authorId: req.user.id, body: note } });
            await tx.editorialTaskEvent.create({ data: { taskId: task.id, actorId: req.user.id, action: action === 'submit' ? 'REVIEW_SUBMITTED' : action === 'approve' ? 'REVIEW_APPROVED' : 'REVIEW_REVISION', details: JSON.stringify({ note }) } });
            const recipients = action === 'submit'
                ? project.members.filter((m) => ['MANAGER', 'EDITOR'].includes(m.role)).map((m) => m.userId)
                : [task.assigneeId, task.createdById];
            await notifyEditorial(tx, project, result, recipients, action === 'submit' ? 'review_submitted' : action === 'approve' ? 'review_approved' : 'review_revision', req.user.id);
            return result;
        });
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


router.get('/projects/:projectId/tasks/:taskId/discussion', async (req, res, next) => {
    try {
        const project = await getProject(req.params.projectId);
        if (!project || !canSee(project, req.user)) return notFound(res);
        const task = await prisma.editorialTask.findFirst({ where: { id: req.params.taskId, projectId: project.id } });
        if (!task) return res.status(404).json({ error: 'Задача не найдена' });
        const [comments, events, applications] = await Promise.all([
            prisma.editorialTaskComment.findMany({ where: { taskId: task.id }, include: { author: { select: { id: true, fullName: true, username: true } } }, orderBy: { createdAt: 'asc' }, take: 300 }),
            prisma.editorialTaskEvent.findMany({ where: { taskId: task.id }, include: { actor: { select: { id: true, fullName: true, username: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
            canEdit(project, req.user) ? prisma.editorialTaskApplication.findMany({ where: { taskId: task.id }, include: { user: { select: { id: true, fullName: true, username: true } } }, orderBy: { createdAt: 'desc' } }) :
                prisma.editorialTaskApplication.findMany({ where: { taskId: task.id, userId: req.user.id }, orderBy: { createdAt: 'desc' } }),
        ]);
        res.json({ comments, events, applications });
    } catch (error) { next(error); }
});

router.post('/projects/:projectId/tasks/:taskId/comments', async (req, res, next) => {
    try {
        const project = await getProject(req.params.projectId);
        if (!project || !canSee(project, req.user)) return notFound(res);
        const task = await prisma.editorialTask.findFirst({ where: { id: req.params.taskId, projectId: project.id } });
        if (!task) return res.status(404).json({ error: 'Задача не найдена' });
        if (!validText(req.body.body, 4000)) return res.status(400).json({ error: 'Комментарий должен содержать от 1 до 4000 символов' });
        const comment = await prisma.$transaction(async (tx) => {
            const created = await tx.editorialTaskComment.create({ data: { taskId: task.id, authorId: req.user.id, body: req.body.body.trim() } });
            await tx.editorialTaskEvent.create({ data: { taskId: task.id, actorId: req.user.id, action: 'COMMENTED' } });
            await notifyEditorial(tx, project, task, [task.assigneeId, task.createdById], 'comment', req.user.id);
            return created;
        });
        res.status(201).json({ comment });
    } catch (error) { next(error); }
});

router.post('/projects/:projectId/tasks/:taskId/applications', async (req, res, next) => {
    try {
        const project = await getProject(req.params.projectId);
        if (!project || !canSee(project, req.user)) return notFound(res);
        const task = await prisma.editorialTask.findFirst({ where: { id: req.params.taskId, projectId: project.id } });
        if (!task) return res.status(404).json({ error: 'Задача не найдена' });
        if (!task.isOpen || task.assigneeId) return res.status(409).json({ error: 'Приём заявок закрыт' });
        if (!project.members.some((member) => member.userId === req.user.id)) return res.status(403).json({ error: 'Заявки доступны участникам проекта' });
        if (typeof req.body.note !== 'string' && req.body.note !== undefined) return res.status(400).json({ error: 'Некорректный комментарий' });
        const note = (req.body.note || '').trim();
        if (note.length > 1000) return res.status(400).json({ error: 'Комментарий слишком длинный' });
        const application = await prisma.editorialTaskApplication.upsert({
            where: { taskId_userId: { taskId: task.id, userId: req.user.id } },
            create: { taskId: task.id, userId: req.user.id, note },
            update: { status: 'PENDING', note, reviewedAt: null, reviewedById: null },
        });
        await prisma.editorialTaskEvent.create({ data: { taskId: task.id, actorId: req.user.id, action: 'APPLIED' } });
        await notifyEditorial(prisma, project, task, project.members.filter((m) => m.role === 'MANAGER' || m.role === 'EDITOR').map((m) => m.userId), 'application', req.user.id);
        res.status(201).json({ application });
    } catch (error) { next(error); }
});

router.patch('/projects/:projectId/tasks/:taskId/applications/:applicationId', async (req, res, next) => {
    try {
        const project = await getProject(req.params.projectId);
        if (!project || !canEdit(project, req.user)) return notFound(res);
        if (!['APPROVED', 'REJECTED'].includes(req.body.status)) return res.status(400).json({ error: 'Некорректное решение' });
        const task = await prisma.editorialTask.findFirst({ where: { id: req.params.taskId, projectId: project.id } });
        if (!task) return res.status(404).json({ error: 'Задача не найдена' });
        const result = await prisma.$transaction(async (tx) => {
            const application = await tx.editorialTaskApplication.findFirst({ where: { id: req.params.applicationId, taskId: task.id, status: 'PENDING' } });
            if (!application) return { error: 'Заявка уже рассмотрена или не найдена' };
            if (req.body.status === 'APPROVED') {
                const claimed = await tx.editorialTask.updateMany({ where: { id: task.id, projectId: project.id, isOpen: true, assigneeId: null }, data: { assigneeId: application.userId, isOpen: false } });
                if (!claimed.count) return { error: 'Задание уже занято или набор закрыт' };
                await tx.editorialTaskApplication.updateMany({ where: { taskId: task.id, status: 'PENDING', id: { not: application.id } }, data: { status: 'REJECTED', reviewedById: req.user.id, reviewedAt: new Date() } });
            }
            const updated = await tx.editorialTaskApplication.update({ where: { id: application.id }, data: { status: req.body.status, reviewedById: req.user.id, reviewedAt: new Date() } });
            await tx.editorialTaskEvent.create({ data: { taskId: task.id, actorId: req.user.id, action: req.body.status === 'APPROVED' ? 'APPLICATION_APPROVED' : 'APPLICATION_REJECTED', details: JSON.stringify({ userId: application.userId }) } });
            await notifyEditorial(tx, project, task, [application.userId], req.body.status === 'APPROVED' ? 'application_approved' : 'application_rejected', req.user.id);
            return { application: updated };
        });
        if (result.error) return res.status(409).json({ error: result.error });
        res.json(result);
    } catch (error) { next(error); }
});

export default router;
