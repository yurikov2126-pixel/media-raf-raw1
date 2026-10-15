import { Router } from 'express';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import { hasPermission } from '../lib/roles.js';
import { prisma } from '../lib/prisma.js';
import { zipEntries, streamZip } from '../lib/editorialZip.js';
import { ensureEditorialThumbnail, thumbnailSupported } from '../lib/editorialThumbnails.js';
import { quarantineLibraryFile, quarantineTaskMaterialFile, restoreRegisteredLibraryFile } from '../lib/storageQuarantine.js';
import { canRemoveEditorialMaterial, canRemoveEditorialProjectFolder } from '../lib/editorialFileDeletion.js';
import { editorialResumableRouter } from '../lib/editorialResumable.js';

const router = Router();
const root = path.resolve(process.env.EDITORIAL_LIBRARY_DIR || 'uploads/editorial');
const materialRoot = path.resolve(process.env.EDITORIAL_MATERIAL_DIR || 'private/editorial-materials');
const materialKey = id => `material:${id}`;
const MAX_SHARED_FILES = 5000;
const hiddenFolderKey = id => 'editorial_files_hidden_project_' + id;
const fileView = file => ({ ...publicFile(file), id: materialKey(file.id), taskId: file.taskId, version: file.version, caption: file.caption, source: 'material' });
const materialIds = ids => ids.filter(id => typeof id === 'string' && id.startsWith('material:')).map(id => id.slice(9));
const libraryIds = ids => ids.filter(id => typeof id === 'string' && !id.startsWith('material:'));
const resolveFiles = async ids => {
    const [library, materials] = await Promise.all([
        prisma.editorialLibraryFile.findMany({ where: { id: { in: libraryIds(ids) } } }),
        prisma.editorialMaterialFile.findMany({ where: { id: { in: materialIds(ids) } } }),
    ]);
    const byId = new Map([...library.map(f => [f.id, { ...f, diskPath: path.join(root, f.storageName) }]), ...materials.map(f => [materialKey(f.id), { ...f, id: materialKey(f.id), diskPath: path.join(materialRoot, f.storageName) }])]);
    return ids.map(id => byId.get(id)).filter(Boolean);
};
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024, files: 1 } });
const publicFile = file => ({ id: file.id, name: file.name, mimeType: file.mimeType, size: file.size, description: file.description || '', createdAt: file.createdAt });
const archive = (res, files, filename) => {
    if (!files.length) return res.status(404).json({ error: 'Нет доступных файлов' });
    const entries = zipEntries(files.map(file => ({ name: file.name, zipFolder: file.zipFolder, path: file.diskPath || path.join(root, file.storageName), size: file.size })));
    const size = entries.reduce((sum, file) => sum + file.size + 200 + Buffer.byteLength(file.zipName), 0);
    if (size > 0xffffffff || entries.length > 65535) return res.status(413).json({ error: 'Архив слишком большой. Скачайте файлы по отдельности.' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    streamZip(entries).on('error', error => { console.error('[editorial-share] zip failed', error); res.destroy(error); }).pipe(res);
};
const sendFile = (res, next, file, download = false) => {
    const previewSafe = file.mimeType.startsWith('image/') && file.mimeType !== 'image/svg+xml' || file.mimeType.startsWith('video/') || file.mimeType === 'application/pdf';
    if (!previewSafe) download = true;
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.sendFile(file.diskPath || path.join(root, file.storageName), error => { if (error && !res.headersSent) next(error); });
};
const getShare = async token => {
    if (!/^[a-f0-9]{48}$/.test(token || '')) return null;
    const share = await prisma.editorialFileShare.findUnique({ where: { token } });
    if (!share || share.revokedAt || (share.expiresAt && share.expiresAt <= new Date())) return null;
    return share;
};
const roleNames = {
    LEAD_PHOTO: 'Основной фотограф', ADDITIONAL_PHOTO: 'Дополнительный фотограф',
    LEAD_VIDEO: 'Основной видеорепортёр', GIMBAL: 'Оператор стабилизатора',
    ACTION_CAMERA: 'Оператор экшн-камеры', SOUND_ENGINEER: 'Звукорежиссёр',
    INTERVIEWER: 'Интервьюер', VIDEO_EDITOR: 'Монтажёр',
};
const shareFolderName = (member, fullName) => {
    const parts = String(fullName || 'Неизвестный участник').trim().split(/\\s+/);
    const person = parts.length === 2 ? parts[1] + ' ' + parts[0] : parts.join(' ');
    return (member?.role === 'MANAGER' ? 'Руководитель' : roleNames[member?.crewPosition] || 'Участник команды') + ' - ' + person;
};
const sharedFolderPaths = async files => {
    const materialIdsInShare = files.filter(f => f.id.startsWith('material:')).map(f => f.id.slice(9));
    if (!materialIdsInShare.length) return new Map();
    const materials = await prisma.editorialMaterialFile.findMany({
        where: { id: { in: materialIdsInShare } },
        select: { id: true, uploaderId: true, task: { select: { id: true, title: true, workDate: true, assigneeId: true, projectId: true, project: { select: { title: true, eventDate:true, eventEndDate:true, members: { select: { userId: true, crewPosition: true, role: true, user: { select: { fullName: true, username: true } } } } } } } } },
    });
    const paths = new Map();
    for (const material of materials) {
        const project = material.task.project;
        const personId = material.task.assigneeId || material.uploaderId;
        const member = project.members.find(m => m.userId === personId);
        const name = member?.user?.fullName || member?.user?.username || 'Неизвестный участник';
        const assigneeName = name;
        const workDate = material.task.workDate ? material.task.workDate.toISOString().slice(0, 10) : null;
        const dayLabel = workDate ? workDate.slice(8, 10) + '.' + workDate.slice(5, 7) + '.' + workDate.slice(0, 4) : 'Без даты';
        const taskFolder = material.task.title + ' · ' + dayLabel + ' · ' + assigneeName;
        paths.set(materialKey(material.id), {
            projectId: material.task.projectId,
            projectTitle: project.title + (project.eventDate ? ' · ' + new Date(project.eventDate).toISOString().slice(0,10).split('-').reverse().join('.') + (project.eventEndDate && +new Date(project.eventEndDate) !== +new Date(project.eventDate) ? ' – ' + new Date(project.eventEndDate).toISOString().slice(0,10).split('-').reverse().join('.') : '') : ' · Без даты'),
            taskId: material.task.id,
            taskTitle: material.task.title,
            workDate,
            assigneeName,
            taskFolder: material.task.title + ' — ' + shareFolderName(member,name),
            personId,
            folder: shareFolderName(member, name),
        });
    }
    return paths;
};
const sharedFiles = async share => resolveFiles(Array.isArray(share.fileIds) ? share.fileIds : []);

router.get('/public/:token', async (req, res, next) => {
    try {
        const share = await getShare(req.params.token);
        if (!share) return res.status(404).json({ error: 'Ссылка недоступна или срок её действия истёк' });
        const files = await sharedFiles(share);
        const paths = await sharedFolderPaths(files);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ share: { title: share.title, description: share.description, createdAt: share.createdAt, expiresAt: share.expiresAt }, files: files.map(file => ({ ...publicFile(file), ...(paths.get(file.id) || {}) })) });
    } catch (error) { next(error); }
});
router.get('/public/:token/archive', async (req, res, next) => {
    try {
        const share = await getShare(req.params.token);
        if (!share) return res.status(404).json({ error: 'Ссылка недоступна' });
        res.setHeader('Cache-Control', 'no-store');
        const files = await sharedFiles(share);
        const paths = await sharedFolderPaths(files);
        return archive(res, files.map(file => ({ ...file, zipFolder: paths.has(file.id) ? [paths.get(file.id).projectTitle, paths.get(file.id).taskFolder].join('/') : 'Общие файлы' })), 'editorial-share.zip');
    } catch (error) { next(error); }
});
router.get('/public/:token/files/:fileId', async (req, res, next) => {
    try {
        const share = await getShare(req.params.token);
        if (!share || !Array.isArray(share.fileIds) || !share.fileIds.includes(req.params.fileId)) return res.status(404).json({ error: 'Файл не найден' });
        const file = (await resolveFiles([req.params.fileId]))[0];
        if (!file) return res.status(404).json({ error: 'Файл не найден' });
        res.setHeader('Cache-Control', 'no-store');
        sendFile(res, next, file, req.query.download === '1');
    } catch (error) { next(error); }
});

// The share token authorizes thumbnails only for files explicitly included in the share.
router.get('/public/:token/files/:fileId/thumbnail', async (req, res, next) => {
    try {
        const share = await getShare(req.params.token);
        if (!share || !Array.isArray(share.fileIds) || !share.fileIds.includes(req.params.fileId)) return res.status(404).json({ error: 'Файл не найден' });
        const file = (await resolveFiles([req.params.fileId]))[0];
        if (!file) return res.status(404).json({ error: 'Файл не найден' });
        if (!thumbnailSupported(file.mimeType)) return res.status(415).json({ error: 'Превью недоступно' });
        const directory = file.id.startsWith('material:') ? materialRoot : root;
        const thumbnailPath = await ensureEditorialThumbnail(directory, file);
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.sendFile(thumbnailPath, error => { if (error && !res.headersSent) next(error); });
    } catch (error) { next(error); }
});

router.use(auth);
router.use(async (req, res, next) => {
    try { if (await hasPermission(req.user, 'editorial.library')) return next();
      return res.status(403).json({ error: 'Нет права управлять библиотекой редакции' });
    } catch (e) { next(e); }
});
router.get('/folders', async (_req, res, next) => {
    try {
        const [projects, files] = await Promise.all([
            prisma.editorialProject.findMany({ select: { id: true, title: true, eventDate: true, eventEndDate: true, completedAt: true, members: { select: { userId: true, crewPosition: true, role: true, user: { select: { fullName: true, username: true } } } }, tasks: { select: { id: true, title: true, assigneeId: true, materialFiles: { select: { id: true, name: true, mimeType: true, size: true, createdAt: true, version: true, caption: true, taskId: true, uploaderId: true } } } } }, orderBy: { updatedAt: 'desc' } }),
            prisma.editorialLibraryFile.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
        ]);
        const roles = {
            LEAD_PHOTO: 'Основной фотограф', ADDITIONAL_PHOTO: 'Дополнительный фотограф',
            LEAD_VIDEO: 'Основной видеорепортёр', GIMBAL: 'Оператор стабилизатора',
            ACTION_CAMERA: 'Оператор экшн-камеры', SOUND_ENGINEER: 'Звукорежиссёр',
            INTERVIEWER: 'Интервьюер', VIDEO_EDITOR: 'Монтажёр',
        };
        const hidden = await prisma.setting.findMany({ where: { key: { startsWith:'editorial_files_hidden_project_' } }, select:{ key:true } });
        const hiddenIds = new Set(hidden.map(item => item.key.slice('editorial_files_hidden_project_'.length)));
        const projectFolders = projects.filter(p => !hiddenIds.has(p.id) || !p.completedAt || p.tasks.some(task => task.materialFiles.length > 0)).map(p => {
            const members = new Map(p.members.map(m => [m.userId, m]));
            const groups = p.tasks.map(task => {
                const assignee = members.get(task.assigneeId);
                const person = assignee?.user?.fullName?.trim() || assignee?.user?.username || 'Не назначен';
                const role = assignee?.role === 'MANAGER' ? 'Руководитель' : (roles[assignee?.crewPosition] || 'Участник команды');
                const files = task.materialFiles.map(file => ({ ...fileView(file), taskTitle:task.title,projectId:p.id }));
                return { id:task.id,title:task.title+' — '+role+' '+person,files };
            });
            const date = value => value ? new Date(value).toISOString().slice(0,10).split('-').reverse().join('.') : '';
            const range = p.eventDate ? date(p.eventDate) + (p.eventEndDate && date(p.eventEndDate)!==date(p.eventDate) ? ' – '+date(p.eventEndDate) : '') : 'Без даты';
            return { id:p.id,title:p.title+' · '+range,folders:groups,files:groups.flatMap(group=>group.files) };
        });
        res.json({ folders: projectFolders, files: files.map(publicFile), stats:{ count:files.length+projectFolders.reduce((sum,p)=>sum+p.files.length,0), size:files.reduce((sum,f)=>sum+f.size,0)+projectFolders.reduce((sum,p)=>sum+p.files.reduce((s,f)=>s+f.size,0),0), photos:files.filter(f=>f.mimeType.startsWith('image/')).length+projectFolders.reduce((sum,p)=>sum+p.files.filter(f=>f.mimeType.startsWith('image/')).length,0), videos:files.filter(f=>f.mimeType.startsWith('video/')).length+projectFolders.reduce((sum,p)=>sum+p.files.filter(f=>f.mimeType.startsWith('video/')).length,0) } });
    } catch (error) { next(error); }
});
// Project folders in this view are virtual. Hiding an empty, completed folder
// never deletes a project, assignment, report or source file.
router.delete('/folders/projects/:projectId', async (req,res,next) => {
    try {
        const project = await prisma.editorialProject.findUnique({ where:{ id:req.params.projectId }, select:{ id:true, completedAt:true, tasks:{ select:{ id:true, status:true, _count:{ select:{ materialFiles:true } } } } } });
        if (!project) return res.status(404).json({ error:'Папка проекта не найдена' });
        const safety = canRemoveEditorialProjectFolder(project);
        if (!safety.allowed) return res.status(409).json({ error:safety.reason });
        await prisma.setting.upsert({ where:{ key:hiddenFolderKey(project.id) }, create:{ key:hiddenFolderKey(project.id),value:'hidden' }, update:{ value:'hidden' } });
        await prisma.adminAction.create({ data:{ adminId:req.user.id, action:'editorial_folder_hidden', payload:JSON.stringify({ projectId:project.id }),affected:1 } }).catch(() => {});
        res.json({ ok:true });
    } catch(error) { next(error); }
});
// Task attachments may be discarded only when both the project and assignment
// have finished. The existing quarantine handles active public shares and recovery.
router.delete('/files/materials/:materialId', async (req,res,next) => {
    try {
        const file = await prisma.editorialMaterialFile.findUnique({ where:{ id:req.params.materialId }, include:{ task:{ select:{ id:true, status:true, projectId:true, project:{ select:{ completedAt:true } } } } } });
        if (!file) return res.status(404).json({ error:'Материал не найден' });
        const safety = canRemoveEditorialMaterial(file);
        if (!safety.allowed) return res.status(409).json({ error:safety.reason });
        const result = await quarantineTaskMaterialFile(file,req.user.id,{ projectId:file.task.projectId });
        res.json({ ok:true, quarantined:true, restoreUntil:result.expiresAt });
    } catch(error) { next(error); }
});

// User-defined virtual folders (library files only), independent of project folders.
// Setting records avoid moving originals or invalidating existing shared links.
const folderKey = id => 'editorial_custom_folder_' + id;
const placementKey = id => 'editorial_custom_file_' + id;
const decodeSetting = row => { try { return JSON.parse(row.value); } catch { return null; } };
router.get('/trash', async (_req,res,next) => {
    try {
        const rows = await prisma.setting.findMany({where:{key:{startsWith:'storage_quarantine_'}}});
        const entries = rows.map(row => decodeSetting(row)).filter(item => item && ['library','materials'].includes(item.type));
        res.json({ entries:entries.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)) });
    } catch(error) { next(error); }
});
router.post('/trash/:id/restore', async (req,res,next) => {
    try {
        const row = await prisma.setting.findUnique({where:{key:'storage_quarantine_' + req.params.id}});
        const item = row && decodeSetting(row);
        if (!item || item.type !== 'library' || !item.originalId) return res.status(409).json({error:'Восстановление этого материала доступно в центре хранения администратора'});
        await restoreRegisteredLibraryFile(item);
        res.json({ok:true});
    } catch(error) { next(error); }
});
router.get('/custom-folders', async (_req,res,next) => {
    try {
        const rows = await prisma.setting.findMany({ where:{ OR:[{ key:{ startsWith:'editorial_custom_folder_' } },{ key:{ startsWith:'editorial_custom_file_' } }] } });
        const folders = rows.filter(row => row.key.startsWith('editorial_custom_folder_')).map(decodeSetting).filter(Boolean);
        const placements = Object.fromEntries(rows.filter(row => row.key.startsWith('editorial_custom_file_')).map(row => [row.key.slice(22),row.value]));
        res.json({ folders, placements });
    } catch(error) { next(error); }
});
router.post('/custom-folders', async (req,res,next) => {
    try {
        const title = String(req.body?.title || '').trim();
        const parentId = req.body?.parentId || null;
        if (!title || title.length > 100 || (parentId !== null && typeof parentId !== 'string')) return res.status(400).json({ error:'Укажите название папки до 100 символов' });
        if (parentId && !(await prisma.setting.findUnique({where:{key:folderKey(parentId)}}))) return res.status(404).json({error:'Родительская папка не найдена'});
        const folder = { id:randomUUID(), title, parentId, createdAt:new Date().toISOString() };
        await prisma.setting.create({data:{key:folderKey(folder.id),value:JSON.stringify(folder)}});
        res.status(201).json({ folder });
    } catch(error) { next(error); }
});
router.patch('/custom-folders/:id', async (req,res,next) => {
    try {
        const row = await prisma.setting.findUnique({where:{key:folderKey(req.params.id)}});
        if (!row) return res.status(404).json({error:'Папка не найдена'});
        const title = String(req.body?.title || '').trim();
        if (!title || title.length > 100) return res.status(400).json({error:'Название должно содержать от 1 до 100 символов'});
        const folder = { ...decodeSetting(row),title };
        await prisma.setting.update({where:{key:row.key},data:{value:JSON.stringify(folder)}});
        res.json({folder});
    } catch(error) { next(error); }
});
router.delete('/custom-folders/:id', async (req,res,next) => {
    try {
        const row = await prisma.setting.findUnique({where:{key:folderKey(req.params.id)}});
        if (!row) return res.status(404).json({error:'Папка не найдена'});
        const children = await prisma.setting.findMany({where:{ OR:[{key:{startsWith:'editorial_custom_folder_'}},{key:{startsWith:'editorial_custom_file_'}}] }});
        if (children.some(item => item.key.startsWith('editorial_custom_folder_') && decodeSetting(item)?.parentId === req.params.id) ||
            children.some(item => item.key.startsWith('editorial_custom_file_') && item.value === req.params.id))
            return res.status(409).json({error:'Папка не пуста. Сначала переместите файлы и вложенные папки.'});
        await prisma.setting.delete({where:{key:row.key}});
        res.json({ok:true});
    } catch(error) { next(error); }
});
router.patch('/files/:fileId/folder', async (req,res,next) => {
    try {
        const file = await prisma.editorialLibraryFile.findUnique({where:{id:req.params.fileId}});
        if (!file) return res.status(404).json({error:'Перемещать можно только файлы библиотеки'});
        const folderId = req.body?.folderId ?? null;
        if (folderId !== null && !(await prisma.setting.findUnique({where:{key:folderKey(folderId)}}))) return res.status(404).json({error:'Папка не найдена'});
        if (folderId === null) await prisma.setting.deleteMany({where:{key:placementKey(file.id)}});
        else await prisma.setting.upsert({where:{key:placementKey(file.id)},create:{key:placementKey(file.id),value:folderId},update:{value:folderId}});
        res.json({ok:true,folderId});
    } catch(error) { next(error); }
});

router.post('/shares/quick', async (req, res, next) => {
    try {
        const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : null;
        const fileId = typeof req.body?.fileId === 'string' ? req.body.fileId : null;
        if (!!projectId === !!fileId) return res.status(400).json({ error: 'Выберите папку или файл' });
        let ids = [];
        let title = '';
        if (projectId) {
            const project = await prisma.editorialProject.findUnique({ where: { id: projectId }, select: { title: true, tasks: { select: { materialFiles: { select: { id: true } } } } } });
            if (!project) return res.status(404).json({ error: 'Проект не найден' });
            ids = project.tasks.flatMap(t => t.materialFiles.map(f => materialKey(f.id)));
            title = project.title;
        } else {
            const file = (await resolveFiles([fileId]))[0];
            if (!file) return res.status(404).json({ error: 'Файл не найден' });
            ids = [fileId]; title = file.name;
        }
        if (!ids.length) return res.status(400).json({ error: 'Нет файлов для передачи' });
        if (ids.length > MAX_SHARED_FILES) return res.status(413).json({ error: `Для одной ссылки доступно не более ${MAX_SHARED_FILES} файлов` });
        const share = await prisma.editorialFileShare.create({ data: { token: randomBytes(24).toString('hex'), title, fileIds: ids, createdById: req.user.id, expiresAt: new Date(Date.now() + 30 * 86400000) } });
        res.status(201).json({ share });
    } catch (error) { next(error); }
});
router.use('/uploads', editorialResumableRouter({
    root,
    scope:'editorial-library',
    allowed: mimeType => typeof mimeType === 'string' && mimeType.length <= 200,
    authorize:async () => true, // The parent router already enforces authentication and editorial.library.
    complete:async (req, session) => {
        const file = await prisma.editorialLibraryFile.create({ data: { name:session.name, storageName:session.storageName, mimeType:session.mimeType, size:session.size, uploaderId:req.user.id } });
        if (thumbnailSupported(file.mimeType)) ensureEditorialThumbnail(root,file).catch(error => console.error('[editorial-library] thumbnail failed',error));
        return publicFile(file);
    },
}));
// Download a selection without creating an external public share.
router.post('/files/archive', async (req,res,next) => {
    try {
        const ids = req.body?.fileIds;
        if (!Array.isArray(ids) || ids.length < 1 || ids.length > 500 || ids.some(id => typeof id !== 'string' || id.length > 256) || new Set(ids).size !== ids.length) return res.status(400).json({error:'Выберите от 1 до 500 разных файлов'});
        const files = await resolveFiles(ids);
        if (files.length !== ids.length) return res.status(404).json({error:'Часть файлов больше недоступна'});
        res.setHeader('Cache-Control','private, no-store');
        return archive(res,files,'editorial-selected.zip');
    } catch(error) { next(error); }
});
const hashFile = file => new Promise((resolve,reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('error',reject);
    stream.on('data',chunk => hash.update(chunk));
    stream.on('end',() => resolve(hash.digest('hex')));
});
router.get('/files/duplicates', async (_req,res,next) => {
    try {
        // Explicit user action only; do not hash large libraries on page load.
        const files = await prisma.editorialLibraryFile.findMany({orderBy:{createdAt:'desc'},take:300});
        const bySize = new Map();
        for (const file of files) bySize.set(file.size,[...(bySize.get(file.size)||[]),file]);
        const byHash = new Map();
        for (const candidates of bySize.values()) {
            if (candidates.length < 2) continue;
            for (const file of candidates) {
                const hash = await hashFile(path.join(root,file.storageName));
                byHash.set(hash,[...(byHash.get(hash)||[]),publicFile(file)]);
            }
        }
        res.json({ groups:[...byHash.entries()].filter(([,items])=>items.length>1).map(([sha256,files])=>({sha256,files})),scanned:files.length,limited:files.length===300 });
    } catch(error) { next(error); }
});
router.get('/files/:fileId/metadata', async (req,res,next) => {
    try {
        const file = (await resolveFiles([req.params.fileId]))[0];
        if (!file) return res.status(404).json({error:'Файл не найден'});
        const result = {name:file.name,mimeType:file.mimeType,size:file.size,createdAt:file.createdAt};
        if (thumbnailSupported(file.mimeType)) {
            const dir = file.id.startsWith('material:') ? materialRoot : root;
            const info = await sharp(path.join(dir,file.storageName),{limitInputPixels:80_000_000}).metadata();
            result.width = info.width; result.height = info.height;
            result.format = info.format; result.orientation = info.orientation;
            if (info.density) result.density = info.density;
            // Deliberately do not transmit raw EXIF: GPS/location and serial numbers are private.
        }
        res.json({metadata:result});
    } catch(error) { next(error); }
});
router.get('/files', async (_req, res, next) => {
    try {
        const [libraryFiles, taskFiles] = await Promise.all([
            prisma.editorialLibraryFile.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
            prisma.editorialMaterialFile.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
        ]);
        res.json({ files: [...libraryFiles.map(publicFile), ...taskFiles.map(fileView)].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)) });
    }
    catch (error) { next(error); }
});
router.post('/files', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Выберите файл' });
        const name = path.basename(req.file.originalname.replace(/\\/g, '/')).slice(0, 255);
        const storageName = randomUUID();
        await fs.mkdir(root, { recursive: true, mode: 0o700 });
        await fs.writeFile(path.join(root, storageName), req.file.buffer, { flag: 'wx', mode: 0o600 });
        try {
            const file = await prisma.editorialLibraryFile.create({ data: { name, storageName, mimeType: req.file.mimetype || 'application/octet-stream', size: req.file.size, uploaderId: req.user.id } });
            if (thumbnailSupported(file.mimeType)) {
                try { await ensureEditorialThumbnail(root, file); }
                catch (error) { console.error('[editorial-library] preview generation failed', error); }
            }
            await prisma.adminAction.create({data:{adminId:req.user.id,action:'storage_upload',payload:JSON.stringify({type:'library',id:file.id,name:file.name,size:file.size,storageName:file.storageName}),affected:1}}).catch(error=>console.error('[storage] upload audit failed',error));
             res.status(201).json({ file: publicFile(file) });
        } catch (error) { await fs.unlink(path.join(root, storageName)).catch(() => {}); throw error; }
    } catch (error) { next(error); }
});
router.delete('/files/:fileId', async (req, res, next) => {
    try {
        const file = await prisma.editorialLibraryFile.findUnique({ where: { id: req.params.fileId } });
        if (!file) return res.status(404).json({ error: 'Файл не найден' });
        const quarantined = await quarantineLibraryFile(file, req.user.id);
        await prisma.setting.deleteMany({ where:{key:placementKey(file.id)} });
        res.json({ ok: true, quarantined: true, restoreUntil: quarantined.expiresAt });
    } catch (error) { next(error); }
});
router.patch('/files/:fileId', async (req, res, next) => {
    try {
        const file = await prisma.editorialLibraryFile.findUnique({ where: { id: req.params.fileId } });
        if (!file) return res.status(404).json({ error: 'Файл не найден или относится к заданию' });
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : null;
        const description = typeof req.body?.description === 'string' ? req.body.description.trim() : null;
        if ((name === null && description === null) || (name !== null && (!name || name.length > 255)) || (description !== null && description.length > 2000)) return res.status(400).json({ error: 'Некорректное название или описание' });
        const updated = await prisma.editorialLibraryFile.update({ where: { id: file.id }, data: { ...(name !== null ? { name } : {}), ...(description !== null ? { description } : {}) } });
        res.json({ file: publicFile(updated) });
    } catch (error) { next(error); }
});
router.get('/files/:fileId/thumbnail', async (req, res, next) => {
    try {
        const file = (await resolveFiles([req.params.fileId]))[0];
        if (!file) return res.status(404).json({ error: 'Файл не найден' });
        if (!thumbnailSupported(file.mimeType)) return res.status(415).json({ error: 'Превью недоступно' });
        const directory = file.id.startsWith('material:') ? materialRoot : root;
        const preview = await ensureEditorialThumbnail(directory, file);
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.sendFile(preview, error => { if (error && !res.headersSent) next(error); });
    } catch (error) { next(error); }
});
router.get('/files/:fileId', async (req, res, next) => {
    try {
        const file = (await resolveFiles([req.params.fileId]))[0];
        if (!file) return res.status(404).json({ error: 'Файл не найден' });
        sendFile(res, next, file, req.query.download === '1');
    } catch (error) { next(error); }
});
router.get('/shares', async (_req, res, next) => {
    try { res.json({ shares: await prisma.editorialFileShare.findMany({ where: { revokedAt: null }, orderBy: { createdAt: 'desc' }, take: 200 }) }); }
    catch (error) { next(error); }
});
router.post('/shares', async (req, res, next) => {
    try {
        const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
        const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
        const fileIds = req.body.fileIds;
        if (!title || title.length > 160 || description.length > 2000 || !Array.isArray(fileIds) || !fileIds.length || fileIds.length > MAX_SHARED_FILES || !fileIds.every(id => typeof id === 'string') || new Set(fileIds).size !== fileIds.length) return res.status(400).json({ error: 'Укажите название и выберите файлы' });
        const count = (await resolveFiles(fileIds)).length;
        if (count !== fileIds.length) return res.status(400).json({ error: 'Некоторые файлы не найдены' });
        const days = req.body.expiresInDays === null ? null : Number(req.body.expiresInDays ?? 30);
        if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) return res.status(400).json({ error: 'Срок действия от 1 до 365 дней' });
        const share = await prisma.editorialFileShare.create({ data: { token: randomBytes(24).toString('hex'), title, description, fileIds, createdById: req.user.id, expiresAt: days === null ? null : new Date(Date.now() + days * 86400000) } });
        res.status(201).json({ share });
    } catch (error) { next(error); }
});
router.post('/shares/:id/revoke', async (req, res, next) => {
    try {
        const result = await prisma.editorialFileShare.deleteMany({ where: { id: req.params.id } });
        if (!result.count) return res.status(404).json({ error: 'Ссылка не найдена' });
        res.json({ ok: true });
    } catch (error) { next(error); }
});
export default router;
