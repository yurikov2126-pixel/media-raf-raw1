import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { safe } from './_shared.js';
const router = Router();
const snapshot = (article, editorId) => ({
  articleId: article.id, editorId, title: article.title, excerpt: article.excerpt,
  content: article.content, cover: article.cover, tags: article.tags,
});
router.get('/wiki/proposals', safe(async (_req,res) => {
  const proposals = await prisma.wikiProposal.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 100 });
  const articles = await prisma.wikiArticle.findMany({ where: { id: { in: proposals.map(p => p.articleId) } }, select: { id: true, title: true, slug: true } });
  const lookup = new Map(articles.map(a => [a.id,a]));
  res.json(proposals.map(p => ({ ...p, article: lookup.get(p.articleId) })));
}));
router.post('/wiki/proposals/:id/review', safe(async (req,res) => {
  if (!['APPROVED','REJECTED'].includes(req.body.status)) return res.status(400).json({ error: 'Некорректное решение' });
  const result = await prisma.$transaction(async tx => {
    const p = await tx.wikiProposal.findUnique({ where: { id: req.params.id } });
    if (!p || p.status !== 'PENDING') return null;
    if (req.body.status === 'APPROVED') {
      const article = await tx.wikiArticle.findUnique({ where: { id: p.articleId } });
      if (!article) return null;
      await tx.wikiRevision.create({ data: snapshot(article, req.user.id) });
      await tx.wikiArticle.update({ where: { id: p.articleId }, data: { content: p.content } });
    }
    return tx.wikiProposal.update({ where: { id: p.id }, data: { status: req.body.status, reviewedBy: req.user.id, reviewedAt: new Date() } });
  });
  if (!result) return res.status(409).json({ error: 'Предложение уже обработано или статья удалена' });
  res.json({ ok: true, status: result.status });
}));
router.get('/wiki/articles/:id/revisions', safe(async (req,res) => {
  const rows = await prisma.wikiRevision.findMany({ where: { articleId: req.params.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json(rows);
}));
router.post('/wiki/articles/:id/revisions/:revisionId/restore', safe(async (req,res) => {
  const result = await prisma.$transaction(async tx => {
    const article = await tx.wikiArticle.findUnique({ where: { id: req.params.id } });
    const revision = await tx.wikiRevision.findFirst({ where: { id: req.params.revisionId, articleId: req.params.id } });
    if (!article || !revision) return null;
    await tx.wikiRevision.create({ data: snapshot(article, req.user.id) });
    return tx.wikiArticle.update({ where: { id: article.id }, data: { title: revision.title, excerpt: revision.excerpt, content: revision.content, cover: revision.cover, tags: revision.tags } });
  });
  if (!result) return res.status(404).json({ error: 'Версия не найдена' });
  res.json({ ok: true });
}));
export default router;
