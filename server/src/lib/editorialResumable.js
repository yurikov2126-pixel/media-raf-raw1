import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';

const CHUNK_SIZE = 2 * 1024 * 1024;
const MAX_SIZE = 200 * 1024 * 1024;
const validateId = id => /^[a-f0-9-]{36}$/.test(id || '');
const scopeFor = (scope, req) => typeof scope === 'function' ? scope(req) : scope;
const sessionsPath = root => path.join(root, '.resumable');
const metadataPath = (root, id) => path.join(sessionsPath(root), id + '.json');
const partPath = (root, id) => path.join(sessionsPath(root), id + '.part');

async function load(root, id, userId, scope) {
    if (!validateId(id)) return null;
    let session;
    try { session = JSON.parse(await fs.readFile(metadataPath(root, id), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (session.userId !== userId || session.scope !== scope) return null;
    return session;
}

export function editorialResumableRouter({ root, scope, authorize, complete, allowed }) {
    const router = express.Router();
    async function permitted(req, res) {
        const result = await authorize(req, res);
        return !!result;
    }
    router.post('/', async (req, res, next) => {
        try {
            if (!await permitted(req,res)) return;
            const { name, mimeType, size, caption = '' } = req.body || {};
            if (typeof name !== 'string' || !name.trim() || name.length > 255 || typeof mimeType !== 'string' || !allowed(mimeType) || !Number.isSafeInteger(size) || size < 1 || size > MAX_SIZE || typeof caption !== 'string' || caption.length > 1000) return res.status(400).json({ error:'Недопустимые параметры файла' });
            await fs.mkdir(sessionsPath(root), { recursive:true, mode:0o700 });
            const id = randomUUID();
            const session = { id, userId:req.user.id, scope:scopeFor(scope,req), name:path.basename(name.replace(/\\/g,'/')), mimeType, size, caption, createdAt:Date.now(), state:'uploading', result:null };
            await fs.writeFile(partPath(root,id), Buffer.alloc(0), { flag:'wx', mode:0o600 });
            await fs.writeFile(metadataPath(root,id), JSON.stringify(session), { flag:'wx', mode:0o600 });
            res.status(201).json({ id, offset:0, chunkSize:CHUNK_SIZE });
        } catch (error) { next(error); }
    });
    router.get('/:id', async (req, res, next) => {
        try {
            if (!await permitted(req,res)) return;
            const session = await load(root,req.params.id,req.user.id,scopeFor(scope,req));
            if (!session) return res.status(404).json({ error:'Загрузка не найдена' });
            const stat = session.state === 'done' ? { size:session.size } : await fs.stat(partPath(root,session.id)).catch(() => ({ size:0 }));
            res.json({ id:session.id, offset:stat.size, size:session.size, chunkSize:CHUNK_SIZE, state:session.state, result:session.result });
        } catch (error) { next(error); }
    });
    router.patch('/:id', express.raw({ type:'application/octet-stream', limit:CHUNK_SIZE + 1024 }), async (req,res,next) => {
        try {
            if (!await permitted(req,res)) return;
            const session = await load(root,req.params.id,req.user.id,scopeFor(scope,req));
            if (!session) return res.status(404).json({ error:'Загрузка не найдена' });
            if (session.state !== 'uploading') return res.status(409).json({ error:'Загрузка уже завершена' });
            const data = req.body;
            const offset = Number(req.headers['upload-offset']);
            if (!Buffer.isBuffer(data) || !data.length || data.length > CHUNK_SIZE || !Number.isSafeInteger(offset) || offset < 0) return res.status(400).json({ error:'Некорректный блок файла' });
            const file = await fs.open(partPath(root,session.id), 'r+');
            let updated;
            try {
                const stat = await file.stat();
                if (offset !== stat.size || offset + data.length > session.size) return res.status(409).json({ error:'Несовпадение позиции', offset:stat.size });
                let written = 0;
                while (written < data.length) {
                    const result = await file.write(data, written, data.length - written, offset + written);
                    if (!result.bytesWritten) throw new Error('Не удалось записать блок');
                    written += result.bytesWritten;
                }
                updated = offset + written;
            } finally { await file.close(); }
            res.json({ offset:updated, size:session.size });
        } catch (error) { next(error); }
    });
    router.post('/:id/finish', async (req,res,next) => {
        try {
            if (!await permitted(req,res)) return;
            const session = await load(root,req.params.id,req.user.id,scopeFor(scope,req));
            if (!session) return res.status(404).json({ error:'Загрузка не найдена' });
            if (session.state === 'done') return res.json({ file:session.result });
            const stat = await fs.stat(partPath(root,session.id));
            if (stat.size !== session.size) return res.status(409).json({ error:'Файл ещё не загружен', offset:stat.size });
            const storageName = randomUUID();
            const destination = path.join(root,storageName);
            await fs.rename(partPath(root,session.id), destination);
            try {
                const saved = await complete(req, { ...session, storageName });
                session.state = 'done'; session.result = saved;
                await fs.writeFile(metadataPath(root,session.id), JSON.stringify(session));
                res.status(201).json({ file:saved });
            } catch (error) {
                await fs.rename(destination,partPath(root,session.id)).catch(() => {});
                throw error;
            }
        } catch (error) { next(error); }
    });
    router.delete('/:id', async (req,res,next) => {
        try {
            if (!await permitted(req,res)) return;
            const session = await load(root,req.params.id,req.user.id,scopeFor(scope,req));
            if (!session) return res.status(404).json({ error:'Загрузка не найдена' });
            if (session.state !== 'done') await fs.unlink(partPath(root,session.id)).catch(() => {});
            await fs.unlink(metadataPath(root,session.id)).catch(() => {});
            res.json({ ok:true });
        } catch (error) { next(error); }
    });
    return router;
}
