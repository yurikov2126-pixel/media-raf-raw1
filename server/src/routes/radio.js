import {validatePlaylistTransitions,scheduledPlaylistDuration} from '../lib/radioPlaylistTransitions.js';
import { validateRadioPlaylistTracks, writeRadioPlaylistItems, MAX_RADIO_PLAYLIST_TRACKS } from '../lib/radioPlaylistBulk.js';
import { Router } from 'express';
import {normalizeRadioTags,safeRadioTags} from '../lib/radioAssetTags.js';
import multer from 'multer';
import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { auth, requireRole } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { readAutoDjSettings, writeAutoDjSettings } from '../lib/radioAutoDj.js';
import { readRotation, writeRotation, rotationPlan, id3Artist, rotationPlaylistAssets } from '../lib/radioRotation.js';
import { readPlayoutHistory } from '../lib/radioPlayoutHistory.js';
import { previewMusicQueue } from '../lib/radioMusicPlanner.js';
import { summarizePlayout, exportPlayoutCsv } from '../lib/radioStationInsights.js';
import { readAudioProcessing, writeAudioProcessing } from '../lib/radioAudioProcessing.js';
import { readCues, writeCue, validateCue } from '../lib/radioAudioCue.js';
import { readJingles, writeJingles, planJingleBreaks } from '../lib/radioJingles.js';
import { workerRequest } from '../lib/radioLiveOpusGateway.js';
import {readSourceControl,writeSourceControl,resolveSourcePriority} from '../lib/radioSourceControl.js';
import {planSourceHandover} from '../lib/radioLiveHandover.js';

const router = Router();
router.use(auth);

// Students access only their own playlists; all legacy radio management remains admin-only.
const reviewInclude = { items: { orderBy: { position: 'asc' }, include: { asset: { select: { id: true, name: true, durationMs: true } } } } };
const studentOnly = async (req, res, next) => {
    try {
        if (req.user.role !== 'STUDENT') return res.status(403).json({ error: 'Только для радиоведущих' });
        const member = await prisma.editorialTeamMember.findUnique({
            where: { userId: req.user.id }, select: { position: true },
        });
        if (member?.position !== 'RADIO_HOST') return res.status(403).json({ error: 'Требуется должность Радиоведущий' });
        next();
    } catch (error) { next(error); }
};
const validStudentBody = body => typeof body?.name === 'string' && body.name.trim().length > 0
    && body.name.trim().length <= 140 && typeof (body.description ?? '') === 'string'
    && (body.description ?? '').length <= 2000 && Array.isArray(body.assetIds)
    && body.assetIds.length <= 100 && body.assetIds.every(id => typeof id === 'string')
    && new Set(body.assetIds).size === body.assetIds.length;
const validAssets = async assetIds => await prisma.radioAsset.count({ where: { id: { in: assetIds } } }) === assetIds.length;

router.get('/access', async (req, res, next) => {
    try {
        if (req.user.role === 'ADMIN') return res.json({ allowed: true, admin: true });
        if (req.user.role !== 'STUDENT') return res.json({ allowed: false, admin: false });
        const member = await prisma.editorialTeamMember.findUnique({
            where: { userId: req.user.id }, select: { position: true },
        });
        res.json({ allowed: member?.position === 'RADIO_HOST', admin: false });
    } catch (error) { next(error); }
});
router.get('/student/playlists', studentOnly, async (req, res, next) => {
    try { res.json({ playlists: await prisma.radioPlaylist.findMany({
        where: { createdBy: req.user.id }, include: reviewInclude, orderBy: { updatedAt: 'desc' }, take: 250,
    }) }); } catch (error) { next(error); }
});
router.get('/student/assets', studentOnly, async (_req, res, next) => {
    try { res.json({ assets: await prisma.radioAsset.findMany({
        select: { id: true, name: true, durationMs: true }, orderBy: { createdAt: 'desc' }, take: 300,
    }) }); } catch(error) { next(error); }
});
router.post('/student/playlists', studentOnly, async (req, res, next) => {
    try {
        if (!validStudentBody(req.body) || !(await validAssets(req.body.assetIds)))
            return res.status(400).json({ error: 'Проверьте название и аудиозаписи' });
        const playlist = await prisma.radioPlaylist.create({ data: {
            name: req.body.name.trim(), description: (req.body.description ?? '').trim(),
            createdBy: req.user.id, status: 'DRAFT',
            items: { create: req.body.assetIds.map((assetId, position) => ({ assetId, position })) },
        }, include: reviewInclude });
        res.status(201).json({ playlist });
    } catch(error) { next(error); }
});
router.put('/student/playlists/:id', studentOnly, async (req, res, next) => {
    try {
        if (!validStudentBody(req.body) || !(await validAssets(req.body.assetIds)))
            return res.status(400).json({ error: 'Проверьте название и аудиозаписи' });
        const result = await prisma.$transaction(async tx => {
            const playlist = await tx.radioPlaylist.findFirst({
                where: { id: req.params.id, createdBy: req.user.id },
            });
            if (!playlist) return 'missing';
            if (!['DRAFT','RETURNED'].includes(playlist.status)) return 'locked';
            await tx.radioPlaylistItem.deleteMany({ where: { playlistId: playlist.id } });
            return tx.radioPlaylist.update({ where: { id: playlist.id }, data: {
                name: req.body.name.trim(), description: (req.body.description ?? '').trim(),
                items: { create: req.body.assetIds.map((assetId, position) => ({ assetId, position })) },
            }, include: reviewInclude });
        });
        if (result === 'missing') return res.status(404).json({ error: 'Плейлист не найден' });
        if (result === 'locked') return res.status(409).json({ error: 'Плейлист уже отправлен или утверждён' });
        res.json({ playlist: result });
    } catch(error) { next(error); }
});
router.post('/student/playlists/:id/submit', studentOnly, async (req, res, next) => {
    try {
        const result = await prisma.$transaction(async tx => {
            const playlist = await tx.radioPlaylist.findFirst({
                where: { id: req.params.id, createdBy: req.user.id }, include: reviewInclude,
            });
            if (!playlist) return 'missing';
            if (!['DRAFT','RETURNED'].includes(playlist.status)) return 'locked';
            if (!playlist.items.length) return 'empty';
            if (playlist.items.reduce((sum, item) => sum + item.asset.durationMs, 0) > 12 * 3600000) return 'long';
            const updated = await tx.radioPlaylist.update({ where: { id: playlist.id }, data: {
                status: 'SUBMITTED', submittedAt: new Date(), reviewedReason: null,
            }, include: reviewInclude });
            const admins = await tx.user.findMany({ where: { role: 'ADMIN', isBanned: false }, select: { id: true } });
            if (admins.length) await tx.notification.createMany({ data: admins.map(admin => ({
                userId: admin.id, type: 'RADIO_PLAYLIST_SUBMITTED',
                payload: JSON.stringify({ playlistId: playlist.id, playlistName: playlist.name, authorId: req.user.id }),
            })) });
            return updated;
        });
        if (typeof result === 'string') return res.status(result === 'missing' ? 404 : 409).json({
            error: {missing:'Плейлист не найден',locked:'Этот плейлист уже отправлен',empty:'Добавьте записи перед отправкой',long:'Плейлист длиннее 12 часов'}[result],
        });
        res.json({ playlist: result });
    } catch(error) { next(error); }
});


const root = path.resolve(process.env.RADIO_ASSET_DIR || 'private/radio-audio');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024, files: 1 } });
const run = promisify(execFile);
const safe = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const playlistInclude = { items: { orderBy: { position: 'asc' }, include: { asset: { select: { id: true, name: true, durationMs: true } } } } };
const hasAudioHeader = bytes =>
    bytes.subarray(0, 3).toString() === 'ID3' ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) ||
    (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WAVE') ||
    bytes.subarray(0, 4).toString() === 'fLaC' ||
    bytes.subarray(0, 4).toString() === 'OggS' ||
    bytes.subarray(4, 8).toString() === 'ftyp';
const validTitle = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 140;
const playlistMs = p => p.items.reduce((sum, item) => sum + item.asset.durationMs, 0);
const RADIO_TIMEZONE = 'Europe/Moscow';
// Europe/Moscow observes UTC+03:00 year-round for contemporary broadcasts.
// Parse wall-clock times on the server, not in the administrator's browser timezone.
function parseMoscowLocal(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return new Date(NaN);
    const instant = new Date(value + ':00+03:00');
    if (!Number.isFinite(instant.getTime())) return instant;
    const actual = new Intl.DateTimeFormat('sv-SE', {
        timeZone: RADIO_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(instant).replace(' ', 'T');
    return actual === value ? instant : new Date(NaN);
}
function broadcastStart(body) {
    return Object.prototype.hasOwnProperty.call(body || {}, 'startLocal')
        ? parseMoscowLocal(body.startLocal)
        : new Date(body?.startAt);
}


router.get('/status', requireRole('ADMIN'), (_req, res) => res.json({
    enabled: true, phase: 'PLANNING', playout: 'NOT_CONFIGURED', amplifier: 'NOT_CONNECTED', timezone: RADIO_TIMEZONE,
}));
router.get('/assets/browse',requireRole('ADMIN'),safe(async(req,res)=>{
 const page=Math.max(1,Math.min(100000,Number.parseInt(req.query.page,10)||1));
 const limit=[25,50,100].includes(Number(req.query.limit))?Number(req.query.limit):50;
 const folderId=typeof req.query.folderId==='string'&&req.query.folderId.length<100?req.query.folderId:null;
 const query=String(req.query.query||'').trim().slice(0,120);
 const order=req.query.sort==='duration'?{durationMs:'desc'}:
   req.query.sort==='recent'?{createdAt:'desc'}:{name:'asc'};
 const where={folderId,...(query?{OR:[
   {name:{contains:query,mode:'insensitive'}},
   {tags:{path:['title'],string_contains:query}},
   {tags:{path:['artist'],string_contains:query}},
   {tags:{path:['album'],string_contains:query}},
 ]}:{})};
 const [total,assets]=await prisma.$transaction([
   prisma.radioAsset.count({where}),
   prisma.radioAsset.findMany({where,orderBy:[order,{id:'asc'}],skip:(page-1)*limit,take:limit}),
 ]);
 res.json({assets,total,page,limit,pages:Math.max(1,Math.ceil(total/limit))});
}));
router.get('/assets', requireRole('ADMIN'), safe(async (_req, res) => {
    res.json({ assets: await prisma.radioAsset.findMany({ orderBy: { createdAt: 'desc' }, take: 300 }) });
}));
const uploadAsset = safe(async (req, res) => {
    const file = req.file;
    if (!file || !file.buffer || !hasAudioHeader(file.buffer))
        return res.status(400).json({ error: 'Требуется поддерживаемый аудиофайл' });
    // Multer/busboy may decode UTF-8 multipart filenames as latin1.
    // Prefer a dedicated UTF-8 field sent by the client; validate and never use it as a disk path.
    const supplied = req.body?.filename;
    const filename = (typeof supplied === 'string' && supplied.trim()
        ? supplied.normalize('NFC')
        : Buffer.from(file.originalname || '', 'latin1').toString('utf8').normalize('NFC')).slice(0, 180);
    if (!filename || !/\.(mp3|wav|ogg|flac|m4a)$/i.test(filename))
        return res.status(400).json({ error: 'Поддерживаются MP3, WAV, OGG, FLAC и M4A' });
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const key = randomUUID() + path.extname(filename).toLowerCase();
    const filePath = path.join(root, key);
    await fs.writeFile(filePath, file.buffer, { flag: 'wx', mode: 0o600 });
    try {
        // Duration comes from ffprobe, not untrusted client-provided metadata.
        const { stdout } = await run('ffprobe', ['-v','error','-show_format','-show_streams','-of','json',filePath], { timeout: 15000, maxBuffer: 256*1024 });
        const probe=JSON.parse(stdout);
        const durationMs = Math.round(Number(probe.format?.duration) * 1000);
        const tags=normalizeRadioTags(probe);
        if (!Number.isFinite(durationMs) || durationMs < 100 || durationMs > 24 * 3600 * 1000)
            return res.status(422).json({ error: 'Не удалось определить длительность' });
        const asset = await prisma.radioAsset.create({ data: {
            name: tags.title ? [tags.artist,tags.title].filter(Boolean).join(' — ').slice(0,140):filename, tags, storageKey: key, mimeType: file.mimetype || 'application/octet-stream',
            byteSize: file.size, durationMs, sha256: createHash('sha256').update(file.buffer).digest('hex'), createdBy: req.user.id,
        } });
        return res.status(201).json({ asset });
    } finally {
        const stored = await prisma.radioAsset.findUnique({ where: { storageKey: key }, select: { id: true } });
        if (!stored) await fs.unlink(filePath).catch(() => {});
    }
});
router.post('/student/assets', studentOnly, upload.single('file'), uploadAsset);
router.post('/assets', requireRole('ADMIN'), upload.single('file'), uploadAsset);
const streamAudio = safe(async (req, res) => {
    const a = await prisma.radioAsset.findUnique({ where: { id: req.params.id } });
    if (!a) return res.status(404).json({ error: 'Запись не найдена' });
    res.setHeader('Content-Type', a.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(path.join(root, path.basename(a.storageKey)));
});
router.get('/student/assets/:id/audio', studentOnly, streamAudio);
router.get('/assets/:id/audio', requireRole('ADMIN'), streamAudio);
router.use(requireRole('ADMIN'));

// Asset metadata may be edited without changing the original audio bytes.
router.get('/asset-folders',requireRole('ADMIN'),safe(async (_req,res)=>{
 res.json({folders:await prisma.radioAssetFolder.findMany({orderBy:{name:'asc'}})});
}));
router.post('/asset-folders',requireRole('ADMIN'),safe(async (req,res)=>{
 if(!validTitle(req.body?.name))return res.status(400).json({error:'Укажите название папки'});
 const parentId=req.body?.parentId||null;
 if(parentId&&!await prisma.radioAssetFolder.findUnique({where:{id:parentId}}))
   return res.status(404).json({error:'Родительская папка не найдена'});
 const folder=await prisma.radioAssetFolder.create({data:{name:req.body.name.trim(),parentId}});
 res.status(201).json({folder});
}));
router.patch('/asset-folders/:id',requireRole('ADMIN'),safe(async (req,res)=>{
 const folder=await prisma.radioAssetFolder.findUnique({where:{id:req.params.id}});
 if(!folder)return res.status(404).json({error:'Папка не найдена'});
 if(!validTitle(req.body?.name))return res.status(400).json({error:'Название недопустимо'});
 const result=await prisma.radioAssetFolder.update({where:{id:folder.id},data:{name:req.body.name.trim()}});
 res.json({folder:result});
}));
router.delete('/asset-folders/:id',requireRole('ADMIN'),safe(async (req,res)=>{
 const folder=await prisma.radioAssetFolder.findUnique({where:{id:req.params.id}});
 if(!folder)return res.status(404).json({error:'Папка не найдена'});
 if(await prisma.radioAsset.count({where:{folderId:folder.id}})||await prisma.radioAssetFolder.count({where:{parentId:folder.id}}))
   return res.status(409).json({error:'Переместите вложенные файлы и папки перед удалением'});
 await prisma.radioAssetFolder.delete({where:{id:folder.id}});
 res.json({ok:true});
}));
router.post('/assets/bulk-move',requireRole('ADMIN'),safe(async(req,res)=>{
 const assetIds=req.body?.assetIds,folderId=req.body?.folderId||null;
 if(!Array.isArray(assetIds)||assetIds.length<1||assetIds.length>200||
   assetIds.some(x=>typeof x!=='string')||new Set(assetIds).size!==assetIds.length)
   return res.status(400).json({error:'Выберите не более 200 уникальных файлов'});
 if(folderId&&!await prisma.radioAssetFolder.findUnique({where:{id:folderId}}))
   return res.status(404).json({error:'Папка назначения не найдена'});
 const exists=await prisma.radioAsset.count({where:{id:{in:assetIds}}});
 if(exists!==assetIds.length)return res.status(409).json({error:'Не все файлы найдены'});
 const result=await prisma.radioAsset.updateMany({where:{id:{in:assetIds}},data:{folderId}});
 res.json({ok:true,moved:result.count});
}));
router.patch('/assets/:id/organize',requireRole('ADMIN'),safe(async (req,res)=>{
 const folderId=req.body?.folderId||null;
 if(folderId&&!await prisma.radioAssetFolder.findUnique({where:{id:folderId}}))
   return res.status(404).json({error:'Папка не найдена'});
 const updated=await prisma.radioAsset.updateMany({where:{id:req.params.id},data:{folderId}});
 if(!updated.count)return res.status(404).json({error:'Файл не найден'});
 res.json({asset:await prisma.radioAsset.findUnique({where:{id:req.params.id}})});
}));
router.patch('/assets/:id/tags',requireRole('ADMIN'),safe(async (req,res)=>{
 const tags=safeRadioTags(req.body?.tags);
 if(!tags)return res.status(400).json({error:'Неверные теги'});
 const updated=await prisma.radioAsset.updateMany({where:{id:req.params.id},data:{tags}});
 if(!updated.count)return res.status(404).json({error:'Файл не найден'});
 res.json({asset:await prisma.radioAsset.findUnique({where:{id:req.params.id}})});
}));
router.post('/assets/:id/rescan-tags',requireRole('ADMIN'),safe(async (req,res)=>{
 const asset=await prisma.radioAsset.findUnique({where:{id:req.params.id}});
 if(!asset)return res.status(404).json({error:'Файл не найден'});
 const full=path.join(root,path.basename(asset.storageKey));
 const {stdout}=await run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',full],{timeout:15000,maxBuffer:256*1024});
 const tags=normalizeRadioTags(JSON.parse(stdout));
 res.json({asset:await prisma.radioAsset.update({where:{id:asset.id},data:{tags}})});
}));
router.patch('/assets/:id', safe(async (req, res) => {
    if (!validTitle(req.body?.name)) return res.status(400).json({ error: 'Укажите название до 140 символов' });
    const updated = await prisma.radioAsset.updateMany({
        where: { id: req.params.id }, data: { name: req.body.name.trim() },
    });
    if (!updated.count) return res.status(404).json({ error: 'Запись не найдена' });
    res.json({ asset: await prisma.radioAsset.findUnique({ where: { id: req.params.id } }) });
}));
router.delete('/assets/:id', safe(async (req, res) => {
    const asset = await prisma.radioAsset.findUnique({ where: { id: req.params.id } });
    if (!asset) return res.status(404).json({ error: 'Запись не найдена' });
    const inUse = await prisma.radioPlaylistItem.count({ where: { assetId: asset.id } });
    if (inUse) return res.status(409).json({ error: 'Запись используется в плейлистах. Сначала уберите её оттуда.' });
    await prisma.radioAsset.delete({ where: { id: asset.id } }).catch(e => {
        if (e.code === 'P2003') return null; throw e;
    });
    if (await prisma.radioAsset.findUnique({ where: { id: asset.id } }))
        return res.status(409).json({ error: 'Запись используется в плейлисте' });
    await fs.unlink(path.join(root, path.basename(asset.storageKey))).catch(error => {
        if (error.code !== 'ENOENT') console.error('[radio] orphan file cleanup:', error);
    });
    res.json({ ok: true });
}));


router.get('/folders', safe(async (_req, res) => {
    const folders = await prisma.radioPlaylistFolder.findMany({
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ folders });
}));
router.post('/folders', safe(async (req, res) => {
    if (!validTitle(req.body?.name)) return res.status(400).json({ error: 'Название папки должно содержать от 1 до 140 символов' });
    const folder = await prisma.radioPlaylistFolder.create({ data: { name: req.body.name.trim() } });
    res.status(201).json({ folder });
}));
router.patch('/folders/:id', safe(async (req, res) => {
    if (!validTitle(req.body?.name)) return res.status(400).json({ error: 'Укажите название папки' });
    const result = await prisma.radioPlaylistFolder.updateMany({
        where: { id: req.params.id }, data: { name: req.body.name.trim() },
    });
    if (!result.count) return res.status(404).json({ error: 'Папка не найдена' });
    res.json({ folder: await prisma.radioPlaylistFolder.findUnique({ where: { id: req.params.id } }) });
}));
router.delete('/folders/:id', safe(async (req, res) => {
    const result = await prisma.$transaction(async tx => {
        const folder = await tx.radioPlaylistFolder.findUnique({ where: { id: req.params.id } });
        if (!folder) return null;
        await tx.radioPlaylist.updateMany({ where: { folderId: folder.id }, data: { folderId: null } });
        await tx.radioPlaylistFolder.delete({ where: { id: folder.id } });
        return true;
    });
    if (!result) return res.status(404).json({ error: 'Папка не найдена' });
    res.json({ ok: true });
}));
router.patch('/playlists/:id/folder', safe(async (req, res) => {
    const { folderId } = req.body || {};
    if (folderId !== null && (typeof folderId !== 'string' || !folderId.trim()))
        return res.status(400).json({ error: 'Неверная папка' });
    if (folderId && !(await prisma.radioPlaylistFolder.findUnique({ where: { id: folderId } })))
        return res.status(404).json({ error: 'Папка не найдена' });
    const updated = await prisma.radioPlaylist.updateMany({
        where: { id: req.params.id }, data: { folderId },
    });
    if (!updated.count) return res.status(404).json({ error: 'Плейлист не найден' });
    res.json({ playlist: await prisma.radioPlaylist.findUnique({ where: { id: req.params.id } }) });
}));
router.delete('/playlists/:id', safe(async (req, res) => {
    const result = await prisma.$transaction(async tx => {
        // Use the same advisory lock as schedule creation to avoid a race with a new slot.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(1729002)`;
        const playlist = await tx.radioPlaylist.findUnique({ where: { id: req.params.id } });
        if (!playlist) return 'missing';
        const slots = await tx.radioScheduleSlot.count({ where: { playlistId: playlist.id } });
        if (slots) return 'in-use';
        const auto = await readAutoDjSettings();
        if (auto.playlistId === playlist.id) return 'autodj';
        await tx.radioPlaylist.delete({ where: { id: playlist.id } });
        return 'deleted';
    });
    if (result === 'missing') return res.status(404).json({ error: 'Плейлист не найден' });
    if (result === 'in-use') return res.status(409).json({ error: 'Нельзя удалить плейлист, который присутствует в сетке вещания' });
    if (result === 'autodj') return res.status(409).json({ error: 'Плейлист выбран в Auto-DJ. Сначала выберите другой плейлист в настройках Auto-DJ' });
    res.json({ ok: true });
}));

router.get('/playlists', safe(async (_req, res) => {
    res.json({ playlists: await prisma.radioPlaylist.findMany({ include: playlistInclude, orderBy: { updatedAt: 'desc' }, take: 250 }) });
}));
// Always resolve editor state from a unique playlist ID, not a cached list or name.
router.get('/playlists/:id', safe(async (req, res) => {
    const playlist = await prisma.radioPlaylist.findUnique({
        where: { id: req.params.id }, include: playlistInclude,
    });
    if (!playlist) return res.status(404).json({ error: 'Плейлист не найден' });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ playlist });
}));
router.post('/playlists', safe(async (req, res) => {
    const { name, description = '', assetIds = [], transitions = [] } = req.body || {};
    if (!validTitle(name) || typeof description !== 'string' || description.length > 2000 ||
        validateRadioPlaylistTracks(assetIds))
        return res.status(400).json({ error: validateRadioPlaylistTracks(assetIds) || 'Неверные данные плейлиста' });
    let validatedTransitions;
    try {validatedTransitions=validatePlaylistTransitions(assetIds,transitions);} catch(error){return res.status(400).json({error:error.message});}
    const unique = [...new Set(assetIds)];
    if (unique.length !== assetIds.length || await prisma.radioAsset.count({ where: { id: { in: unique } } }) !== unique.length)
        return res.status(400).json({ error: 'Одна или несколько записей не найдены' });
    const playlist = await prisma.$transaction(async tx => {
        const created = await tx.radioPlaylist.create({ data: {
            name: name.trim(), description: description.trim(), createdBy: req.user.id,
            status: 'APPROVED', approvedBy: req.user.id, approvedAt: new Date(),
        } });
        await writeRadioPlaylistItems(tx,created.id,assetIds,validatedTransitions);
        return tx.radioPlaylist.findUnique({where:{id:created.id},include:playlistInclude});
    },{maxWait:10000,timeout:60000});
    res.status(201).json({ playlist });
}));
router.put('/playlists/:id', safe(async (req, res) => {
    const { name, description = '', assetIds = [] } = req.body || {};
    if (!validTitle(name) || typeof description !== 'string' || description.length > 2000 ||
        validateRadioPlaylistTracks(assetIds))
        return res.status(400).json({ error: validateRadioPlaylistTracks(assetIds) || 'Неверные данные плейлиста' });
    const unique = [...new Set(assetIds)];
    if (unique.length !== assetIds.length || await prisma.radioAsset.count({ where: { id: { in: unique } } }) !== unique.length)
        return res.status(400).json({ error: 'Записи не найдены или повторяются' });
    const playlist = await prisma.$transaction(async tx => {
        const current = await tx.radioPlaylist.findUnique({ where: { id: req.params.id } });
        if (!current) return null;
        // Existing approved playlists are editable by ADMIN; recalculate all future
        // slot endings atomically and refuse changes that would overlap other shows.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(1729002)`;
        const newAssets = await tx.radioAsset.findMany({ where: { id: { in: assetIds } }, select: { id: true, durationMs: true } });
        const lengths = new Map(newAssets.map(a => [a.id, a.durationMs]));
        let durationMs;
        try { durationMs=scheduledPlaylistDuration(assetIds.map((id,index)=>({durationMs:lengths.get(id),transition:validatedTransitions[index]}))); }
        catch {return false;}
        const future = await tx.radioScheduleSlot.findMany({ where: { playlistId: current.id, startAt: { gt: new Date() } } });
        if (future.length && (!durationMs || durationMs > 12 * 3600000)) return false;
        for (const slot of future) {
            const newEnd = new Date(slot.startAt.getTime() + durationMs);
            const collision = await tx.radioScheduleSlot.findFirst({
                where: { id: { not: slot.id }, startAt: { lt: newEnd }, endAt: { gt: slot.startAt } },
                select: { id: true },
            });
            if (collision) return false;
        }
        await tx.radioPlaylistItem.deleteMany({ where: { playlistId: current.id } });
        const updated = await tx.radioPlaylist.update({ where: { id: current.id }, data: {
            name: name.trim(), description: description.trim(),
            // Preserve approved status and approval attribution; this edit is by ADMIN.
        }, include: playlistInclude });
        await writeRadioPlaylistItems(tx,current.id,assetIds,validatedTransitions);
        for (const slot of future) {
            await tx.radioScheduleSlot.update({ where: { id: slot.id }, data: { endAt: new Date(slot.startAt.getTime() + durationMs) } });
        }
        return tx.radioPlaylist.findUnique({where:{id:updated.id},include:playlistInclude});
    },{maxWait:10000,timeout:60000});
    if (playlist === null) return res.status(404).json({ error: 'Плейлист не найден' });
    if (playlist === false) return res.status(409).json({ error: 'Редактирование создаёт конфликт в запланированном эфире. Изменения не сохранены' });
    res.json({ playlist });
}));
router.post('/playlists/:id/approve', safe(async (req, res) => {
    const result = await prisma.$transaction(async tx => {
        const playlist = await tx.radioPlaylist.findUnique({ where: { id: req.params.id }, include: playlistInclude });
        if (!playlist) return { status: 404, error: 'Плейлист не найден' };
        if (playlist.status === 'APPROVED') return { playlist };
        if (playlist.status !== 'SUBMITTED') return { status: 409, error: 'Студент ещё не отправил плейлист' };
        const author = await tx.user.findUnique({ where: { id: playlist.createdBy }, select: { role: true } });
        if (author?.role !== 'STUDENT') return { status: 409, error: 'Утверждаются только студенческие плейлисты' };
        const duration = playlistMs(playlist);
        if (!playlist.items.length || duration <= 0 || duration > 12 * 3600000)
            return { status: 409, error: 'Недопустимая длительность плейлиста' };
        const updated = await tx.radioPlaylist.update({ where: { id: playlist.id }, data: {
            status: 'APPROVED', approvedBy: req.user.id, approvedAt: new Date(), reviewedReason: null,
        }, include: playlistInclude });
        await tx.notification.create({ data: { userId: playlist.createdBy,
            type: 'RADIO_PLAYLIST_APPROVED',
            payload: JSON.stringify({ playlistId: playlist.id, playlistName: playlist.name, reviewerId: req.user.id }),
        } });
        return { playlist: updated };
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ playlist: result.playlist });
}));
router.post('/playlists/:id/return', safe(async (req, res) => {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason || reason.length > 1000) return res.status(400).json({ error: 'Укажите причину возврата (до 1000 символов)' });
    const result = await prisma.$transaction(async tx => {
        const playlist = await tx.radioPlaylist.findUnique({ where: { id: req.params.id } });
        if (!playlist) return 'missing';
        if (playlist.status !== 'SUBMITTED') return 'locked';
        const author = await tx.user.findUnique({ where: { id: playlist.createdBy }, select: { role: true } });
        if (author?.role !== 'STUDENT') return 'not-student';
        const updated = await tx.radioPlaylist.update({ where: { id: playlist.id }, data: {
            status: 'RETURNED', reviewedReason: reason, approvedBy: null, approvedAt: null,
        }, include: playlistInclude });
        await tx.notification.create({ data: { userId: playlist.createdBy,
            type: 'RADIO_PLAYLIST_RETURNED',
            payload: JSON.stringify({ playlistId: playlist.id, playlistName: playlist.name, reason, reviewerId: req.user.id }),
        } });
        return updated;
    });
    if (typeof result === 'string') return res.status(result === 'missing' ? 404 : 409).json({
        error: {missing:'Плейлист не найден',locked:'Плейлист не ожидает проверки','not-student':'Возврат предусмотрен только для студентов'}[result],
    });
    res.json({ playlist: result });
}));
router.get('/audio-cues', safe(async (_req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.json({cues:await readCues()});
}));
router.put('/audio-cues/:assetId', safe(async (req,res)=>{
    const asset=await prisma.radioAsset.findUnique({where:{id:req.params.assetId},select:{durationMs:true}});
    if(!asset)return res.status(404).json({error:'Аудиофайл не найден'});
    try {
      const cue=validateCue(req.body,asset.durationMs);
      await writeCue(req.params.assetId,cue);
      res.json({cue});
    }catch(error){if(error instanceof TypeError)return res.status(400).json({error:error.message});throw error;}
}));
router.get('/audio-processing', safe(async (_req,res) => {
    res.setHeader('Cache-Control','no-store');
    res.json({settings:await readAudioProcessing()});
}));
router.put('/audio-processing', safe(async (req,res) => {
    try {
        const settings=await writeAudioProcessing(req.body);
        res.json({settings});
    } catch(error) {
        if(error instanceof TypeError)return res.status(400).json({error:error.message});
        throw error;
    }
}));
router.get('/music-plan', safe(async(_req,res)=>{
  const auto=await readAutoDjSettings();
  const rotation=await readRotation();
  const playlist=auto.playlistId?await prisma.radioPlaylist.findUnique({
    where:{id:auto.playlistId},include:{items:{orderBy:{position:'asc'},include:{asset:true}}}
  }):null;
  const assets=playlist?.status==='APPROVED'?playlist.items.map(i=>i.asset)
    .filter(a=>Number.isInteger(a.durationMs)&&a.durationMs>=1000):[];
  const plan=previewMusicQueue({assets,settings:{rotation,cues:await readCues()},
    history:await readPlayoutHistory(),limit:10});
  res.setHeader('Cache-Control','no-store');
  res.json({plan,approved:playlist?.status==='APPROVED'});
}));
router.get('/playout-insights', safe(async(req,res)=>{
 const hours=Number(req.query.hours||24);
 if(![1,6,24,72].includes(hours))return res.status(400).json({error:'Допустимые окна: 1, 6, 24, 72 часа'});
 res.setHeader('Cache-Control','no-store');
 res.json({insights:summarizePlayout(await readPlayoutHistory(),Date.now(),hours)});
}));
router.get('/playout-history.csv', safe(async(_req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Content-Type','text/csv; charset=utf-8');
 res.setHeader('Content-Disposition','attachment; filename="radio-playout-history.csv"');
 res.send(exportPlayoutCsv(await readPlayoutHistory()));
}));
router.get('/playout-history', safe(async(_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.json({events:(await readPlayoutHistory()).slice(-50).reverse()});
}));
router.get('/source-handover/preview', safe(async(_req,res)=>{
 const now=new Date();
 const [settings,auto,next,scheduled]=await Promise.all([
  readSourceControl(),readAutoDjSettings(),
  prisma.radioScheduleSlot.findFirst({where:{startAt:{gt:now},playlist:{status:'APPROVED'}},
   orderBy:{startAt:'asc'},select:{startAt:true}}),
  prisma.radioScheduleSlot.findFirst({where:{startAt:{lte:now},endAt:{gt:now},playlist:{status:'APPROVED'}},
   select:{id:true}})
 ]);
 const plan=planSourceHandover({settings,autoDjEnabled:auto.enabled,
  scheduled:!!scheduled,scheduledAt:next?.startAt?.toISOString()||null,
  liveConnected:false,pcmSamplesReceived:false,nowMs:now.getTime()});
 res.setHeader('Cache-Control','no-store');
 res.json({plan,simulated:true});
}));
router.get('/source-control', safe(async(_req,res)=>{
 const settings=await readSourceControl();
 const autoDj=await readAutoDjSettings();
 const now=new Date();
 const scheduled=await prisma.radioScheduleSlot.findFirst({
  where:{startAt:{lte:now},endAt:{gt:now},playlist:{status:'APPROVED'}},
  select:{id:true,startAt:true,endAt:true}
 });
 res.setHeader('Cache-Control','no-store');
 // Browser/WebRTC studio is not yet connected to PCM Worker; never report live audio as ready.
 const decision=resolveSourcePriority({settings,scheduled:!!scheduled,
  liveConnected:false,autoDjEnabled:autoDj.enabled});
 res.json({settings,decision,scheduled,livePcmConnected:false,activeSwitching:false});
}));
router.put('/source-control', safe(async(req,res)=>{
 try{
  const current=await readSourceControl();
  const settings=await writeSourceControl({...current,...req.body});
  res.json({settings,activeSwitching:false});
 }catch(error){
  if(error instanceof TypeError)return res.status(400).json({error:error.message});
  throw error;
 }
}));
router.get('/jingles', safe(async(_req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.json({settings:await readJingles()});
}));
router.put('/jingles', safe(async(req,res)=>{
 try{
  const input=req.body;
  // Only existing radio assets can be included in a station jingle library.
  const settings=await readJingles();
  const proposed={...settings,...input};
  if(!Array.isArray(proposed.assetIds))return res.status(400).json({error:'Неверный список джинглов'});
  const count=await prisma.radioAsset.count({where:{id:{in:proposed.assetIds}}});
  if(count!==new Set(proposed.assetIds).size)return res.status(400).json({error:'Выберите существующие аудиозаписи'});
  res.json({settings:await writeJingles(proposed)});
 }catch(error){
  if(error instanceof TypeError)return res.status(400).json({error:error.message});
  throw error;
 }
}));
router.get('/jingles/preview', safe(async(_req,res)=>{
 const settings=await readJingles();
 const rotation=await readRotation();
 const auto=await readAutoDjSettings();
 const playlist=auto.playlistId?await prisma.radioPlaylist.findUnique({
  where:{id:auto.playlistId},include:{items:{orderBy:{position:'asc'},include:{asset:true}}}
 }):null;
 const planned=playlist?.status==='APPROVED'
  ?previewMusicQueue({assets:playlist.items.map(i=>i.asset),settings:{rotation,cues:await readCues()},history:await readPlayoutHistory()})
  :{daypart:null,tracks:[]};
 const library=settings.assetIds.length?await prisma.radioAsset.findMany({where:{id:{in:settings.assetIds}}}):[];
 let worker=null;
 try{worker=await workerRequest('GET','/health');}catch{ /* public Worker not available */ }
 const onAir=worker?.jingles||null;
 res.setHeader('Cache-Control','no-store');
 res.json({active:Boolean(onAir?.enabled&&settings.enabled),workerAvailable:worker!==null,
  workerPlayoutEnabled:onAir?.enabled??null,played:onAir?.played??null,
  musicSinceJingle:onAir?.musicSinceJingle??null,workerMode:worker?.mode??null,
  daypart:planned.daypart,
  breaks:planJingleBreaks({tracks:planned.tracks,settings,daypart:planned.daypart,assets:library}),
  note:worker===null?'Нет ответа от публичного Worker; прогноз не подтверждает фактический эфир':
   !settings.enabled?'Джинглы отключены в настройках':
   !onAir?.enabled?'Проигрывание джинглов запрещено настройкой Worker':
   'Включено для Auto-DJ: джинглы добавляются между композициями, приоритет LIVE и расписания сохраняется'});
}));
router.get('/rotation/assets', safe(async(_req,res)=>{
  const autoDj=await readAutoDjSettings();
  const playlist=autoDj.playlistId?await prisma.radioPlaylist.findUnique({
    where:{id:autoDj.playlistId},
    include:{items:{orderBy:{position:'asc'},include:{asset:true}}}
  }):null;
  const tracks=rotationPlaylistAssets(playlist).map(asset=>({
    id:asset.id,name:asset.name,artist:id3Artist(asset)||null
  }));
  res.setHeader('Cache-Control','no-store');
  res.json({playlistId:playlist?.status==='APPROVED'?playlist.id:null,
    playlistName:playlist?.status==='APPROVED'?playlist.name:null,tracks});
}));
router.get('/rotation/preview', safe(async(_req,res)=>{
  const settings=await readRotation();
  const autoDj=await readAutoDjSettings();
  const playlist=autoDj.playlistId?await prisma.radioPlaylist.findUnique({
    where:{id:autoDj.playlistId},
    include:{items:{orderBy:{position:'asc'},include:{asset:true}}}
  }):null;
  if(!playlist||playlist.status!=='APPROVED')return res.json({daypart:null,tracks:[]});
  const assets=rotationPlaylistAssets(playlist);
  const result=rotationPlan(assets,settings,Date.now());
  res.setHeader('Cache-Control','no-store');
  res.json({daypart:result?.daypart||null,tracks:(result?.items||assets).slice(0,15).map(a=>({
    id:a.id,name:a.name,artist:typeof a.tags?.artist==='string'?a.tags.artist:null
  }))});
}));
router.get('/rotation', safe(async(_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.json({rotation:await readRotation()});
}));
router.put('/rotation', safe(async(req,res)=>{
  try {res.json({rotation:await writeRotation(req.body)});}
  catch(e){if(e instanceof TypeError)return res.status(400).json({error:e.message});throw e;}
}));
router.get('/autodj', safe(async (_req,res) => {
    res.json({settings:await readAutoDjSettings()});
}));
router.put('/autodj', safe(async (req,res) => {
    const {enabled,playlistId,finishTrackBeforeSchedule=false}=req.body||{};
    if(typeof enabled!=='boolean'||typeof finishTrackBeforeSchedule!=='boolean'||(playlistId!==null&&typeof playlistId!=='string'))
        return res.status(400).json({error:'Укажите enabled и playlistId'});
    if(enabled) {
        if(!playlistId)return res.status(400).json({error:'Выберите утверждённый плейлист'});
        const playlist=await prisma.radioPlaylist.findUnique({where:{id:playlistId},
          include:{items:{include:{asset:true}}}});
        if(!playlist||playlist.status!=='APPROVED'||!playlist.items.length)
          return res.status(400).json({error:'Авто-DJ требует утверждённый непустой плейлист'});
    }
    await writeAutoDjSettings({enabled,playlistId:playlistId||null,finishTrackBeforeSchedule});
    res.json({settings:await readAutoDjSettings()});
}));
router.get('/schedule', safe(async (req, res) => {
    // Retire finished one-time slots after a safety window; playout history remains separate.
    // The lock coordinates cleanup with schedule edits and playlist deletion.
    await prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1729002)`;
      await tx.radioScheduleSlot.deleteMany({where:{endAt:{lt:new Date(Date.now()-24*3600000)}}});
    });
    const from = new Date(req.query.from), to = new Date(req.query.to);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to - from > 45 * 86400000)
        return res.status(400).json({ error: 'Неверный диапазон (не более 45 дней)' });
    res.json({ slots: await prisma.radioScheduleSlot.findMany({ where: { startAt: { lt: to }, endAt: { gt: from } },
        include: { playlist: { include: playlistInclude } }, orderBy: { startAt: 'asc' }, take: 500 }) });
}));
// Planning slots reserve editor time only. Without an approved playlist they are
// intentionally excluded from playout, public now-playing and offline agent sync.
function planningFields(payload) {
    const title=typeof payload.title==='string'?payload.title.trim():'';
    const durationMinutes=Number(payload.durationMinutes);
    if (!title || title.length>120 || !Number.isInteger(durationMinutes) ||
        durationMinutes<1 || durationMinutes>720) return null;
    return {title,durationMinutes};
}
router.post('/schedule', safe(async (req, res) => {
    const { playlistId } = req.body || {};
    const startAt = broadcastStart(req.body);
    if (!Number.isFinite(startAt.getTime()) || startAt < new Date(Date.now() - 60000))
        return res.status(400).json({ error: 'Укажите будущее время' });
    let durationMs, title='';
    if (playlistId == null) {
        const planned=planningFields(req.body||{});
        if (!planned) return res.status(400).json({error:'Укажите название и длительность 1–720 минут'});
        durationMs=planned.durationMinutes*60000;
        title=planned.title;
    } else {
        const playlist = await prisma.radioPlaylist.findUnique({ where: { id: playlistId }, include: playlistInclude });
        if (!playlist || playlist.status !== 'APPROVED' || !playlist.items.length)
            return res.status(400).json({ error: 'Плейлист не утверждён' });
        durationMs = playlistMs(playlist);
        if (!durationMs || durationMs > 12 * 3600000) return res.status(400).json({ error: 'Недопустимая продолжительность' });
    }
    const endAt = new Date(startAt.getTime() + durationMs);
    // Serialize scheduling writes to prevent concurrent overlaps.
    const slot = await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(1729002)`;
        const clash = await tx.radioScheduleSlot.findFirst({ where: { startAt: { lt: endAt }, endAt: { gt: startAt } } });
        if (clash) return null;
        return tx.radioScheduleSlot.create({ data: { playlistId:playlistId||null, title, startAt, endAt, createdBy: req.user.id } });
    });
    if (!slot) return res.status(409).json({ error: 'Этот интервал уже занят' });
    res.status(201).json({ slot });
}));

router.post('/schedule/weekly', safe(async (req, res) => {
    const { playlistId, weekdays, weeks } = req.body || {};
    const startAt = broadcastStart(req.body || {});
    if (typeof playlistId !== 'string' || !Number.isFinite(startAt.getTime()) || startAt.getTime() <= Date.now() ||
        !Array.isArray(weekdays) || !weekdays.length || weekdays.length > 7 ||
        weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) ||
        new Set(weekdays).size !== weekdays.length ||
        !Number.isInteger(weeks) || weeks < 1 || weeks > 12)
        return res.status(400).json({ error: 'Укажите будущее время, дни недели и период от 1 до 12 недель' });
    const playlist = await prisma.radioPlaylist.findUnique({ where: { id: playlistId }, include: playlistInclude });
    if (!playlist || playlist.status !== 'APPROVED' || !playlist.items.length)
        return res.status(400).json({ error: 'Плейлист не утверждён' });
    const durationMs = playlistMs(playlist);
    if (!durationMs || durationMs > 12 * 3600000)
        return res.status(400).json({ error: 'Недопустимая продолжительность' });
    // Every weekday and clock time is evaluated in Europe/Moscow (UTC+03:00).
    const candidateTimes = [];
    for (let offset = 0; offset < weeks * 7; offset++) {
        const point = new Date(startAt.getTime() + offset * 86400000);
        if (weekdays.includes(new Date(point.getTime() + 3 * 3600000).getUTCDay())) candidateTimes.push(point);
    }
    if (!candidateTimes.length) return res.status(400).json({ error: 'Не найдены подходящие дни' });
    const result = await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(1729002)`;
        const clash = await tx.radioScheduleSlot.findFirst({ where: { OR: candidateTimes.map(t => ({
            startAt: { lt: new Date(t.getTime() + durationMs) }, endAt: { gt: t },
        })) } });
        if (clash) return null;
        return tx.radioScheduleSlot.createMany({ data: candidateTimes.map(t => ({
            playlistId, startAt: t, endAt: new Date(t.getTime() + durationMs), createdBy: req.user.id,
        })) });
    });
    if (!result) return res.status(409).json({ error: 'Есть пересечение. Повторения не созданы.' });
    res.status(201).json({ created: result.count, timezone: RADIO_TIMEZONE });
}));

router.patch('/schedule/:id', safe(async (req, res) => {
    // Move the slot and/or replace its approved playlist atomically.
    const payload = req.body || {};
    const startAt = payload.startLocal || payload.startAt ? broadcastStart(payload) : null;
    if (startAt && (!Number.isFinite(startAt.getTime()) || startAt.getTime() <= Date.now()))
        return res.status(400).json({ error: 'Укажите будущее время начала эфира (Москва UTC+3)' });
    if (payload.playlistId !== undefined && payload.playlistId !== null && (typeof payload.playlistId !== 'string' || !payload.playlistId))
        return res.status(400).json({ error: 'Выберите утверждённый плейлист' });
    if (!startAt && payload.playlistId === undefined && payload.title === undefined && payload.durationMinutes === undefined)
        return res.status(400).json({ error: 'Укажите новое время или плейлист' });
    const result = await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(1729002)`;
        const slot = await tx.radioScheduleSlot.findUnique({ where: { id: req.params.id } });
        if (!slot) return { status: 404, error: 'Эфир не найден' };
        if (slot.startAt <= new Date()) return { status: 409, error: 'Начавшийся или прошедший эфир переносить нельзя' };
        let playlistId = slot.playlistId;
        let title=slot.title;
        let length = slot.endAt.getTime() - slot.startAt.getTime();
        if (payload.playlistId === null) {
            const planned=planningFields(payload);
            if (!planned) return {status:400,error:'Укажите название и длительность 1–720 минут'};
            playlistId=null;title=planned.title;length=planned.durationMinutes*60000;
        } else if (slot.playlistId===null && payload.playlistId===undefined) {
            if (payload.title!==undefined || payload.durationMinutes!==undefined) {
                const planned=planningFields({title:payload.title??slot.title,
                    durationMinutes:payload.durationMinutes??Math.round(length/60000)});
                if (!planned) return {status:400,error:'Укажите название и длительность 1–720 минут'};
                title=planned.title;length=planned.durationMinutes*60000;
            }
        }
        if (payload.playlistId && payload.playlistId !== slot.playlistId) {
            const playlist = await tx.radioPlaylist.findUnique({
                where: { id: payload.playlistId }, include: playlistInclude,
            });
            if (!playlist || playlist.status !== 'APPROVED' || !playlist.items.length)
                return { status: 400, error: 'Новый плейлист не утверждён или пуст' };
            length = playlistMs(playlist);
            playlistId = playlist.id;
        }
        if (length <= 0 || length > 12 * 3600000)
            return { status: 409, error: 'Некорректная продолжительность передачи' };
        const nextStart = startAt || slot.startAt;
        const endAt = new Date(nextStart.getTime() + length);
        const conflict = await tx.radioScheduleSlot.findFirst({
            where: { id: { not: slot.id }, startAt: { lt: endAt }, endAt: { gt: nextStart } },
            select: { id: true },
        });
        if (conflict) return { status: 409, error: 'В выбранное время уже запланирован другой эфир' };
        const updated = await tx.radioScheduleSlot.update({ where: { id: slot.id }, data: { startAt: nextStart, endAt, playlistId, title } });
        return { slot: updated };
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
}));

router.delete('/schedule/:id', safe(async (req, res) => {
    const result = await prisma.radioScheduleSlot.deleteMany({ where: { id: req.params.id, startAt: { gt: new Date() } } });
    if (!result.count) return res.status(404).json({ error: 'Будущий эфир не найден' });
    res.json({ ok: true });
}));

export default router;
