import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
const router = Router();
router.use(auth);
export const ids = raw => { try { const a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a.filter(x => typeof x === 'string') : []; } catch { return []; } };
export async function validatedCompetencyIds(value) {
    if (!Array.isArray(value) || value.length > 30 || value.some(v => typeof v !== 'string')) throw Object.assign(new Error('Некорректные компетенции'), {status:400});
    const unique = [...new Set(value)];
    const count = await prisma.academyCompetency.count({ where: { id: { in: unique }, active: true } });
    if (count !== unique.length) throw Object.assign(new Error('Компетенция не найдена или отключена'), {status:400});
    return JSON.stringify(unique);
}
router.get('/', async (_req,res,next)=>{try {res.json(await prisma.academyCompetency.findMany({orderBy:{name:'asc'}}));}catch(e){next(e);}});
router.post('/', async (req,res,next)=>{try {
    if(req.user.role !== 'ADMIN')return res.status(403).json({error:'Нет прав'});
    const name=String(req.body?.name||'').trim(),description=String(req.body?.description||'').trim(),icon=String(req.body?.icon||'award').trim();
    if(!name || name.length>100 || description.length>500 || icon.length>40)return res.status(400).json({error:'Некорректные поля'});
    res.status(201).json(await prisma.academyCompetency.create({data:{name,description,icon}}));
}catch(e){next(e);}});
router.patch('/:id',async(req,res,next)=>{try {
    if(req.user.role !== 'ADMIN')return res.status(403).json({error:'Нет прав'});
    const data={};
    for(const k of ['name','description','icon'])if(req.body[k]!==undefined){
        if(typeof req.body[k]!=='string'||req.body[k].length>(k==='description'?500:100))return res.status(400).json({error:'Некорректные поля'});
        data[k]=req.body[k].trim();
    }
    if(req.body.active!==undefined) {
        if(typeof req.body.active!=='boolean')return res.status(400).json({error:'Некорректное состояние'});
        data.active=req.body.active;
    }
    res.json(await prisma.academyCompetency.update({where:{id:req.params.id},data}));
}catch(e){next(e);}});
router.get('/verified/:userId',async(req,res,next)=>{try {
    const certs=await prisma.certificate.findMany({where:{userId:req.params.userId},select:{course:{select:{competencyIds:true}}}});
    const earned=[...new Set(certs.flatMap(c=>ids(c.course.competencyIds)))];
    const items=await prisma.academyCompetency.findMany({where:{id:{in:earned}} ,orderBy:{name:'asc'}});
    res.json(items);
}catch(e){next(e);}});
export default router;
