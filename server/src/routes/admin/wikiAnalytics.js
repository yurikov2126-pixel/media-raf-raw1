import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { safe } from './_shared.js';
const router = Router();
router.get('/wiki/analytics', safe(async (_req,res)=>{
 const [articles, bookmarks, readers, proposals] = await Promise.all([
  prisma.wikiArticle.findMany({ select:{id:true,slug:true,title:true,views:true,published:true,updatedAt:true,category:{select:{title:true}}}, orderBy:{views:'desc'} }),
  prisma.wikiUserState.groupBy({by:['articleId'],where:{bookmarked:true},_count:{_all:true}}),
  prisma.wikiUserState.groupBy({by:['articleId'],where:{lastReadAt:{not:null}},_count:{_all:true}}),
  prisma.wikiProposal.groupBy({by:['articleId','status'],_count:{_all:true}})
 ]);
 const b=new Map(bookmarks.map(r=>[r.articleId,r._count._all]));
 const r=new Map(readers.map(x=>[x.articleId,x._count._all]));
 const p=new Map();
 for(const x of proposals){const obj=p.get(x.articleId)||{};obj[x.status]=x._count._all;p.set(x.articleId,obj);}
 res.json({articles:articles.map(a=>({...a,bookmarks:b.get(a.id)||0,readers:r.get(a.id)||0,proposals:p.get(a.id)||{}})),totals:{articles:articles.length,views:articles.reduce((n,a)=>n+a.views,0),bookmarks:bookmarks.reduce((n,a)=>n+a._count._all,0)}});
}));
export default router;
