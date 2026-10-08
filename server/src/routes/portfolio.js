import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);
const defaults = { headline: '', about: '', specialization: '', skills: [], links: [], featuredPostIds: [], accent: 'violet', layout: 'grid' };
const parse = (s) => { try { return JSON.parse(s); } catch { return []; } };
const present = (p) => p ? { ...p, skills: parse(p.skills), links: parse(p.links), featuredPostIds: parse(p.featuredPostIds) } : defaults;
const safeUrl = (v) => {
    if (!v) return '';
    try { const u = new URL(v); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; }
};
const trim = (value, max) => String(value ?? '').trim().slice(0, max + 1);
async function getOwner(username) {
    return prisma.user.findUnique({ where: { username }, select: { id: true } });
}
router.get('/user/:username', async (req, res) => {
    const owner = await getOwner(req.params.username);
    if (!owner) return res.status(404).json({ error: 'Пользователь не найден' });
    const [portfolio, projects] = await Promise.all([
        prisma.portfolioProfile.findUnique({ where: { ownerId: owner.id } }),
        prisma.creativeProject.findMany({ where: { ownerId: owner.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    res.json({ portfolio: present(portfolio), projects });
});
router.put('/me', async (req, res) => {
    const b = req.body || {};
    const headline = trim(b.headline, 100), about = trim(b.about, 2000), specialization = trim(b.specialization, 100);
    if ([headline.length > 100, about.length > 2000, specialization.length > 100].some(Boolean)) return res.status(400).json({ error: 'Слишком длинное поле портфолио' });
    if (!Array.isArray(b.skills) || b.skills.length > 20 || b.skills.some((x) => typeof x !== 'string' || x.length > 40)) return res.status(400).json({ error: 'До 20 навыков, каждый до 40 символов' });
    if (!Array.isArray(b.links) || b.links.length > 8 || b.links.some((x) => !x || typeof x.label !== 'string' || x.label.length > 50 || !safeUrl(x.url))) return res.status(400).json({ error: 'Укажите до 8 корректных ссылок' });
    if (!Array.isArray(b.featuredPostIds) || b.featuredPostIds.length > 6 || new Set(b.featuredPostIds).size !== b.featuredPostIds.length || b.featuredPostIds.some((x) => typeof x !== 'string')) return res.status(400).json({ error: 'Можно выбрать до 6 уникальных публикаций' });
    const owned = await prisma.post.count({ where: { authorId: req.user.id, id: { in: b.featuredPostIds } } });
    if (owned !== b.featuredPostIds.length) return res.status(400).json({ error: 'Можно выбирать только свои публикации' });
    if (!['violet', 'pink', 'cyan', 'amber', 'emerald'].includes(b.accent) || !['grid', 'list'].includes(b.layout)) return res.status(400).json({ error: 'Недопустимое оформление' });
    const data = { headline, about, specialization, skills: JSON.stringify(b.skills.map((x) => x.trim()).filter(Boolean)), links: JSON.stringify(b.links.map((x) => ({ label: x.label.trim(), url: safeUrl(x.url) }))), featuredPostIds: JSON.stringify(b.featuredPostIds), accent: b.accent, layout: b.layout };
    const updated = await prisma.portfolioProfile.upsert({ where: { ownerId: req.user.id }, create: { ownerId: req.user.id, ...data }, update: data });
    res.json(present(updated));
});
function projectData(b) {
    const title = trim(b.title, 100), description = trim(b.description, 2000), role = trim(b.role, 100), collaborators = trim(b.collaborators, 500), link = trim(b.link, 500);
    if (!title || title.length > 100 || description.length > 2000 || role.length > 100 || collaborators.length > 500 || link.length > 500 || (link && !safeUrl(link))) return null;
    const coverUrl = b.coverUrl ? String(b.coverUrl) : null;
    if (coverUrl && (coverUrl.length > 1000 || (!coverUrl.startsWith('/uploads/') && !safeUrl(coverUrl)))) return null;
    return { title, description, role, collaborators, link: link ? safeUrl(link) : '', coverUrl };
}
router.post('/projects', async (req, res) => {
    const data = projectData(req.body || {});
    if (!data) return res.status(400).json({ error: 'Проверьте данные проекта' });
    if (await prisma.creativeProject.count({ where: { ownerId: req.user.id } }) >= 50) return res.status(400).json({ error: 'Не более 50 проектов' });
    res.status(201).json(await prisma.creativeProject.create({ data: { ...data, ownerId: req.user.id } }));
});
router.patch('/projects/:id', async (req, res) => {
    const existing = await prisma.creativeProject.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Проект не найден' });
    if (existing.ownerId !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });
    const data = projectData(req.body || {});
    if (!data) return res.status(400).json({ error: 'Проверьте данные проекта' });
    res.json(await prisma.creativeProject.update({ where: { id: existing.id }, data }));
});
router.delete('/projects/:id', async (req, res) => {
    const existing = await prisma.creativeProject.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Проект не найден' });
    if (existing.ownerId !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });
    await prisma.creativeProject.delete({ where: { id: existing.id } });
    res.json({ ok: true });
});
export default router;
