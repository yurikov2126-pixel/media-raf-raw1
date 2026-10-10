import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(auth);
const root = path.resolve(process.env.EDITORIAL_MATERIAL_DIR || 'private/editorial-materials');
const allowed = new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024, files: 1 } });
const manager = (project, user) => user.role === 'ADMIN' || project.members.some(m => m.userId === user.id && ['MANAGER','EDITOR'].includes(m.role));

async function context(req, res) {
    const project = await prisma.editorialProject.findUnique({ where: { id: req.params.projectId }, include: { members: true } });
    if (!project || (req.user.role !== 'ADMIN' && !project.members.some(m => m.userId === req.user.id))) { res.status(404).json({ error: 'Проект не найден' }); return null; }
    const task = await prisma.editorialTask.findFirst({ where: { id: req.params.taskId, projectId: project.id } });
    if (!task) { res.status(404).json({ error: 'Задание не найдено' }); return null; }
    return { project, task };
}

router.get('/projects/:projectId/tasks/:taskId/materials', async (req,res,next) => {
    try {
        const ctx = await context(req,res); if (!ctx) return;
        const files = await prisma.editorialMaterialFile.findMany({ where: { taskId: ctx.task.id }, orderBy: [{ version: 'desc' }, { createdAt: 'asc' }], select: { id:true, name:true, mimeType:true, size:true, caption:true, version:true, createdAt:true, uploaderId:true } });
        res.json({ files });
    } catch (e) { next(e); }
});

router.post('/projects/:projectId/tasks/:taskId/materials', upload.single('file'), async (req,res,next) => {
    try {
        const ctx = await context(req,res); if (!ctx) return;
        if (!manager(ctx.project,req.user) && ctx.task.assigneeId !== req.user.id) return res.status(403).json({ error: 'Нет прав на загрузку' });
        if (!['TODO','IN_PROGRESS','REVISION'].includes(ctx.task.status)) return res.status(409).json({ error: 'Для загрузки верните задание в работу' });
        if (!req.file || !allowed.has(req.file.mimetype)) return res.status(400).json({ error: 'Недопустимый тип файла' });
        const caption = String(req.body.caption || '').trim();
        if (caption.length > 1000) return res.status(400).json({ error: 'Подпись слишком длинная' });
        const latest = await prisma.editorialTaskEvent.findFirst({ where: { taskId: ctx.task.id, action: 'REVIEW_SUBMITTED' }, orderBy: { createdAt: 'desc' } });
        const version = (await prisma.editorialTaskEvent.count({ where: { taskId: ctx.task.id, action: 'REVIEW_SUBMITTED' } })) + 1;
        void latest;
        await fs.mkdir(root, { recursive: true });
        const storageName = randomUUID();
        await fs.writeFile(path.join(root,storageName),req.file.buffer,{ flag:'wx' });
        try {
            const file = await prisma.editorialMaterialFile.create({ data: { taskId:ctx.task.id, uploaderId:req.user.id, version, name:path.basename(req.file.originalname).slice(0,255), mimeType:req.file.mimetype, size:req.file.size, storageName, caption } });
            res.status(201).json({ file });
        } catch (e) { await fs.unlink(path.join(root,storageName)).catch(()=>{}); throw e; }
    } catch (e) { next(e); }
});

router.patch('/projects/:projectId/tasks/:taskId/materials/:fileId', async (req,res,next) => {
    try {
        const ctx=await context(req,res); if (!ctx) return;
        const file=await prisma.editorialMaterialFile.findFirst({ where:{ id:req.params.fileId,taskId:ctx.task.id } });
        if (!file) return res.status(404).json({error:'Файл не найден'});
        if (file.uploaderId!==req.user.id && !manager(ctx.project,req.user)) return res.status(403).json({error:'Нет прав'});
        if (!['TODO','IN_PROGRESS','REVISION'].includes(ctx.task.status)) return res.status(409).json({error:'Материалы уже отправлены'});
        const caption=req.body?.caption;
        if (typeof caption!=='string'||caption.length>1000) return res.status(400).json({error:'Некорректная подпись'});
        res.json({file:await prisma.editorialMaterialFile.update({where:{id:file.id},data:{caption:caption.trim()}})});
    } catch(e){next(e);}
});

router.get('/projects/:projectId/tasks/:taskId/materials/:fileId/content',async(req,res,next)=>{
    try {
        const ctx=await context(req,res);if(!ctx)return;
        const file=await prisma.editorialMaterialFile.findFirst({where:{id:req.params.fileId,taskId:ctx.task.id}});
        if(!file)return res.status(404).json({error:'Файл не найден'});
        res.setHeader('Content-Type',file.mimeType);
        res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
        res.setHeader('X-Content-Type-Options','nosniff');
        res.setHeader('Cache-Control','private, no-store');
        res.sendFile(path.join(root,file.storageName),(err)=>{if(err&&!res.headersSent)next(err);});
    }catch(e){next(e);}
});
export default router;
