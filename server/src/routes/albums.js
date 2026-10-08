import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

function photosFromPost(post) {
    if (!post.mediaUrl || post.mediaType === 'video') return [];
    if (post.mediaType === 'gallery') {
        try { const urls = JSON.parse(post.mediaUrl); return Array.isArray(urls) ? urls : []; }
        catch { return []; }
    }
    return [post.mediaUrl];
}
function present(album) {
    let photos = [];
    try { photos = JSON.parse(album.photos); } catch {}
    return { ...album, photos };
}
async function availablePhotos(ownerId) {
    const posts = await prisma.post.findMany({ where: { authorId: ownerId }, select: { mediaUrl: true, mediaType: true } });
    return new Set(posts.flatMap(photosFromPost));
}
function normalize(body, available) {
    const title = String(body.title ?? '').trim();
    const description = String(body.description ?? '').trim();
    if (!title || title.length > 80 || description.length > 500) throw new Error('Название: 1–80 символов, описание: до 500');
    if (!Array.isArray(body.photos) || body.photos.length > 100) throw new Error('В альбоме может быть до 100 фотографий');
    if (body.photos.some((url) => typeof url !== 'string' || !available.has(url)) || new Set(body.photos).size !== body.photos.length) throw new Error('Выберите уникальные фотографии из своих публикаций');
    if (body.coverUrl != null && body.coverUrl !== '' && !body.photos.includes(body.coverUrl)) throw new Error('Обложка должна быть фотографией альбома');
    return { title, description, photos: JSON.stringify(body.photos), coverUrl: body.coverUrl || body.photos[0] || null };
}
router.get('/user/:username', async (req, res) => {
    const owner = await prisma.user.findUnique({ where: { username: req.params.username }, select: { id: true } });
    if (!owner) return res.status(404).json({ error: 'Пользователь не найден' });
    const albums = await prisma.photoAlbum.findMany({ where: { ownerId: owner.id }, orderBy: { createdAt: 'desc' } });
    res.json(albums.map(present));
});
router.post('/', async (req, res) => {
    try {
        const count = await prisma.photoAlbum.count({ where: { ownerId: req.user.id } });
        if (count >= 30) return res.status(400).json({ error: 'Можно создать не более 30 альбомов' });
        const data = normalize(req.body, await availablePhotos(req.user.id));
        const album = await prisma.photoAlbum.create({ data: { ...data, ownerId: req.user.id } });
        res.status(201).json(present(album));
    } catch (error) { res.status(400).json({ error: error.message }); }
});
router.patch('/:id', async (req, res) => {
    const album = await prisma.photoAlbum.findUnique({ where: { id: req.params.id } });
    if (!album) return res.status(404).json({ error: 'Альбом не найден' });
    if (album.ownerId !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });
    try {
        const data = normalize(req.body, await availablePhotos(req.user.id));
        res.json(present(await prisma.photoAlbum.update({ where: { id: album.id }, data })));
    } catch (error) { res.status(400).json({ error: error.message }); }
});
router.delete('/:id', async (req, res) => {
    const album = await prisma.photoAlbum.findUnique({ where: { id: req.params.id } });
    if (!album) return res.status(404).json({ error: 'Альбом не найден' });
    if (album.ownerId !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });
    await prisma.photoAlbum.delete({ where: { id: album.id } });
    res.json({ ok: true });
});
export default router;
