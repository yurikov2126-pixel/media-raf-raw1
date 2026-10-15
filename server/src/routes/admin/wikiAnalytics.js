import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { safe } from './_shared.js';
const router=Router();
router.get('/wiki/analytics',safe(async(req,res)=>{
 const articles=await prisma.wikiArticle.findMany({
  select:{id:true,slug:true,title:true,views:true,updatedAt:true,published:true,category:{select:{title:true}}},
  orderBy:{views:'desc'},take:1000
 });
 const states=await prisma.wikiUserState.groupBy({by:['articleId'],_count:{_all:true},where:{lastReadAt:{not:null}}});
 const favorites=await prisma.wikiUserState.groupBy({by:['articleId'],_count:{_all:true},where:{bookmarked:true}});
 const readMap=new Map(states.map(x=>[x.articleId,x._count._all]));
 const bookmarkMap=new Map(favorites.map(x=>[x.articleId,x._count._all]));
 res.json({total:articles.length,articles:articles.map(a=>({...a,readers:readMap.get(a.id)||0,bookmarks:bookmarkMap.get(a.id)||0}))});
}));
export default router;
