import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ensureEditorialThumbnail, thumbnailSupported } from '../lib/editorialThumbnails.js';
import { zipEntries, streamZip } from '../lib/editorialZip.js';
import { editorialResumableRouter } from '../lib/editorialResumable.js';
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

router.use('/projects/:projectId/tasks/:taskId/materials/uploads', editorialResumableRouter({
    root,
    scope: req => 'editorial-task:' + req.params.projectId + ':' + req.params.taskId,
    allowed: mimeType => allowed.has(mimeType),
    authorize: async (req,res) => {
        const ctx = await context(req,res); if (!ctx) return false;
        if (!manager(ctx.project,req.user) && ctx.task.assigneeId !== req.user.id) { res.status(403).json({ error:'Нет прав на загрузку' }); return false; }
        if (!['TODO','IN_PROGRESS','REVISION'].includes(ctx.task.status)) { res.status(409).json({ error:'Для загрузки верните задание в работу' }); return false; }
        return true;
    },
    complete: async (req, session) => {
        const ctx = await context(req, { status:() => ({ json:()=>{} }) });
        if (!ctx) throw new Error('Задание не найдено');
        const version = (await prisma.editorialTaskEvent.count({ where: { taskId:ctx.task.id, action:'REVIEW_SUBMITTED' } })) + 1;
        const file = await prisma.editorialMaterialFile.create({ data:{ taskId:ctx.task.id, uploaderId:req.user.id, version, name:session.name, mimeType:session.mimeType, size:session.size, storageName:session.storageName, caption:session.caption } });
        if (thumbnailSupported(file.mimeType)) ensureEditorialThumbnail(root,file).catch(error => console.error('[editorial-materials] thumbnail failed',error));
        return file;
    },
}));
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
        const version = (await prisma.editorialTaskEvent.count({ where: { taskId: ctx.task.id, action: 'REVIEW_SUBMITTED' } })) + 1;
        await fs.mkdir(root, { recursive: true });
        const storageName = randomUUID();
        await fs.writeFile(path.join(root,storageName),req.file.buffer,{ flag:'wx' });
        try {
            const file = await prisma.editorialMaterialFile.create({ data: { taskId:ctx.task.id, uploaderId:req.user.id, version, name:path.basename(req.file.originalname).slice(0,255), mimeType:req.file.mimetype, size:req.file.size, storageName, caption } });
            if (thumbnailSupported(file.mimeType)) {
                try { await ensureEditorialThumbnail(root, file); }
                catch (error) { console.error('[editorial-materials] thumbnail generation failed', error); }
            }
            await prisma.adminAction.create({data:{adminId:req.user.id,action:'storage_upload',payload:JSON.stringify({type:'materials',id:file.id,name:file.name,size:file.size,storageName:file.storageName,taskId:file.taskId}),affected:1}}).catch(error=>console.error('[storage] upload audit failed',error));
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

// Authenticated on-demand thumbnails: never expose original file paths.
// Generate once on disk to avoid repeatedly decoding large camera photos.
// Download a single review version or all versions as a private ZIP archive.
router.get('/projects/:projectId/tasks/:taskId/materials/archive', async (req,res,next) => {
    try {
        const ctx = await context(req,res); if (!ctx) return;
        const requested = req.query.version;
        if (requested !== undefined && (!/^\\d+$/.test(String(requested)) || Number(requested) < 1)) {
            return res.status(400).json({ error:'Некорректная версия' });
        }
        const where = { taskId:ctx.task.id, ...(requested === undefined ? {} : { version:Number(requested) }) };
        const files = await prisma.editorialMaterialFile.findMany({ where, orderBy:[{version:'desc'},{createdAt:'asc'}] });
        if (!files.length) return res.status(404).json({ error:'Материалы не найдены' });
        if (files.length > 500) return res.status(413).json({ error:'Слишком много файлов для одного архива' });
        // ZIP32 only: reject oversized downloads before sending response headers.
        const total = files.reduce((n,f) => n + f.size, 0);
        if (total > 3_500_000_000) return res.status(413).json({ error:'Архив слишком большой. Скачайте версии по отдельности.' });
        const entries = zipEntries(files.map(f => ({ name:`v${f.version}/${f.name}`, size:f.size, path:path.join(root,f.storageName), caption:f.caption, version:f.version, createdAt:f.createdAt })));
        // Keep version folders while sanitizing user-supplied filename components.
        for (let index=0; index<entries.length; index++) entries[index].zipName = `Версия ${files[index].version}/${entries[index].zipName}`;
        // Export only the original attachments. Captions remain in the gallery UI.
        const estimatedOverhead = entries.reduce((n,f) => n + 76 + 2 * Buffer.byteLength(f.zipName,'utf8'), 22);
        if (total + estimatedOverhead > 0xffffffff) return res.status(413).json({ error:'Архив слишком большой' });
        // Detect missing files before streaming; avoid truncated ZIP from missing originals.
        for (const file of entries) {
            const stat = await fs.stat(file.path);
            if (stat.size !== file.size) return res.status(409).json({ error:'Размер файла на диске изменился' });
        }
        const name = requested === undefined ? 'materials-all.zip' : `materials-version-${requested}.zip`;
        res.setHeader('Content-Type','application/zip');
        res.setHeader('Content-Disposition',`attachment; filename="${name}"`);
        res.setHeader('Cache-Control','private, no-store');
        res.setHeader('X-Content-Type-Options','nosniff');
        const stream = streamZip(entries);
        req.on('close', () => { if (!res.writableFinished) stream.destroy(); });
        stream.on('error', err => { if (!res.headersSent) next(err); else res.destroy(err); });
        stream.pipe(res);
    } catch(e) { next(e); }
});

router.get('/projects/:projectId/tasks/:taskId/materials/:fileId/thumbnail', async (req,res,next) => {
    try {
        const ctx = await context(req,res); if (!ctx) return;
        const file = await prisma.editorialMaterialFile.findFirst({ where: { id:req.params.fileId, taskId:ctx.task.id } });
        if (!file) return res.status(404).json({ error:'Файл не найден' });
        if (!thumbnailSupported(file.mimeType)) return res.status(415).json({ error:'Миниатюра недоступна для этого формата' });
        const thumbnailPath = await ensureEditorialThumbnail(root, file);
        res.setHeader('Content-Type','image/webp');
        res.setHeader('X-Content-Type-Options','nosniff');
        res.setHeader('Cache-Control','private, max-age=300');
        res.sendFile(thumbnailPath, err => { if (err && !res.headersSent) next(err); });
    } catch(e) { next(e); }
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
