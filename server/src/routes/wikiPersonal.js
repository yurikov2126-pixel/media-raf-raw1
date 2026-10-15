import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
import { createNotification } from '../lib/notify.js';

const router = Router();
router.use(auth);
const fail = (res, error) => { console.error('[wiki stage2]', error); return res.status(500).json({ error: 'Не удалось выполнить действие' }); };
const asJson = (value, fallback = []) => { try { return JSON.parse(value || '[]'); } catch { return fallback; } };

router.get('/me', async (req, res) => {
  try {
    const states = await prisma.wikiUserState.findMany({ where: { userId: req.user.id }, orderBy: { lastReadAt: 'desc' }, take: 150 });
    const ids = [...new Set(states.map(s => s.articleId))];
    const articles = await prisma.wikiArticle.findMany({ where: { id: { in: ids }, published: true }, select: { id: true, slug: true, title: true, excerpt: true, cover: true } });
    const byId = new Map(articles.map(a => [a.id, a]));
    res.json(states.filter(s => byId.has(s.articleId)).map(s => ({ ...s, checklist: asJson(s.checklist), article: byId.get(s.articleId) })));
  } catch (e) { fail(res,e); }
});

router.get('/state/:slug', async (req,res) => {
  try {
    const article = await prisma.wikiArticle.findUnique({ where: { slug: req.params.slug }, select: { id: true, published: true } });
    if (!article?.published) return res.status(404).json({ error: 'Статья не найдена' });
    const state = await prisma.wikiUserState.upsert({
      where: { userId_articleId: { userId: req.user.id, articleId: article.id } },
      create: { userId: req.user.id, articleId: article.id, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    res.json({ bookmarked: state.bookmarked, checklist: asJson(state.checklist), lastReadAt: state.lastReadAt });
  } catch (e) { fail(res,e); }
});

router.patch('/state/:slug', async (req,res) => {
  try {
    const article = await prisma.wikiArticle.findUnique({ where: { slug: req.params.slug }, select: { id: true, published: true, content: true } });
    if (!article?.published) return res.status(404).json({ error: 'Статья не найдена' });
    const data = {};
    if (typeof req.body.bookmarked === 'boolean') data.bookmarked = req.body.bookmarked;
    if (req.body.checklist !== undefined) {
      const taskCount = (article.content.match(/^\s*- \[ \] /gm) || []).length;
      if (!Array.isArray(req.body.checklist) || req.body.checklist.length > 200 ||
        req.body.checklist.some(v => !Number.isInteger(v) || v < 0 || v >= taskCount))
        return res.status(400).json({ error: 'Некорректный список выполненных пунктов' });
      data.checklist = JSON.stringify([...new Set(req.body.checklist)]);
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Нет изменений' });
    const state = await prisma.wikiUserState.upsert({ where: { userId_articleId: { userId: req.user.id, articleId: article.id } },
      create: { userId: req.user.id, articleId: article.id, ...data }, update: data });
    res.json({ bookmarked: state.bookmarked, checklist: asJson(state.checklist) });
  } catch (e) { fail(res,e); }
});

router.post('/proposals/:slug', async (req,res) => {
  try {
    const content = String(req.body.content || '').trim();
    const note = String(req.body.note || '').trim().slice(0,500);
    if (content.length < 20 || content.length > 150000) return res.status(400).json({ error: 'Текст правки должен содержать от 20 до 150000 символов' });
    const article = await prisma.wikiArticle.findUnique({ where: { slug: req.params.slug }, select: { id: true, published: true } });
    if (!article?.published) return res.status(404).json({ error: 'Статья не найдена' });
    const pending = await prisma.wikiProposal.count({ where: { articleId: article.id, authorId: req.user.id, status: 'PENDING' } });
    if (pending > 2) return res.status(429).json({ error: 'Сначала дождитесь рассмотрения предыдущих предложений' });
    const proposal = await prisma.wikiProposal.create({ data: { articleId: article.id, authorId: req.user.id, content, note } });
    const admins = await prisma.user.findMany({where:{role:'ADMIN'},select:{id:true}});
    const articleName = await prisma.wikiArticle.findUnique({where:{id:article.id},select:{title:true}});
    const author = await prisma.user.findUnique({where:{id:req.user.id},select:{fullName:true,username:true}});
    await Promise.all(admins.filter(a=>a.id!==req.user.id).map(a=>createNotification(a.id,'system',{
      title:'Предложена правка ВикиМедиа',
      message:(author?.fullName || author?.username || 'Участник')+' предложил исправление статьи «'+(articleName?.title || req.params.slug)+'».',
      url:'/app/admin?tab=wiki'
    })));
    res.status(201).json({ id: proposal.id, status: proposal.status });
  } catch (e) { fail(res,e); }
});

export default router;
