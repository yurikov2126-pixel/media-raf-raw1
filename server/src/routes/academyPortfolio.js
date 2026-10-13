import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
const router = Router();
router.use(auth);
const safeFiles = raw => {
    try { return JSON.parse(raw || '[]').filter(f => f && typeof f.url === 'string' && f.url.startsWith('/uploads/')).map(f => ({url:f.url,name:f.name||'Файл',type:f.type||''})); }
    catch { return []; }
};
router.get('/mine', async (req,res,next)=>{
    try {
        const items=await prisma.homeworkSubmission.findMany({
            where:{userId:req.user.id,status:'APPROVED'},
            orderBy:{reviewedAt:'desc'},
            include:{homework:{include:{lesson:{include:{course:{select:{title:true,slug:true}}}}}}},
        });
        res.json(items.map(x=>({
            id:x.id,title:x.homework.title,courseTitle:x.homework.lesson.course.title,
            courseSlug:x.homework.lesson.course.slug,lessonOrder:x.homework.lesson.order,
            files:safeFiles(x.files),link:x.link,description:x.text,
            grade:x.finalGrade??x.grade,approvedAt:x.reviewedAt,published:x.portfolioPublished,
        })));
    } catch(e){next(e);}
});
router.patch('/:id',async(req,res,next)=>{
    try {
        if(typeof req.body?.published!=='boolean')return res.status(400).json({error:'Некорректное значение'});
        const item=await prisma.homeworkSubmission.findFirst({where:{id:req.params.id,userId:req.user.id},select:{status:true}});
        if(!item)return res.status(404).json({error:'Работа не найдена'});
        if(req.body.published&&item.status!=='APPROVED')return res.status(409).json({error:'Публиковать можно только принятую работу'});
        const updated=await prisma.homeworkSubmission.update({where:{id:req.params.id},data:{portfolioPublished:req.body.published}});
        res.json({published:updated.portfolioPublished});
    }catch(e){next(e);}
});
router.get('/user/:username',async(req,res,next)=>{
    try {
        const user=await prisma.user.findUnique({where:{username:req.params.username},select:{id:true}});
        if(!user)return res.status(404).json({error:'Профиль не найден'});
        const items=await prisma.homeworkSubmission.findMany({
            where:{userId:user.id,status:'APPROVED',portfolioPublished:true},
            orderBy:{reviewedAt:'desc'},
            include:{homework:{include:{lesson:{include:{course:{select:{title:true,slug:true}}}}}}},
            take:50,
        });
        res.json(items.map(x=>({id:x.id,title:x.homework.title,
            courseTitle:x.homework.lesson.course.title,courseSlug:x.homework.lesson.course.slug,
            lessonOrder:x.homework.lesson.order,files:safeFiles(x.files),link:x.link,
            description:x.text?.slice(0,1200)||'',approvedAt:x.reviewedAt})));
    }catch(e){next(e);}
});
export default router;
