import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
const router = Router();
router.use(auth);
router.use((req,res,next) => req.user.role === 'ADMIN' ? next() : res.status(403).json({ error: 'Доступ только администратору' }));
router.get('/', async (_req,res,next) => {
  try {
    const [setting, seasons] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'gamification_seasons_enabled' } }),
      prisma.gamificationSeason.findMany({ orderBy: { startsAt: 'asc' } })
    ]);
    res.json({ enabled: setting?.value !== 'false', seasons });
  } catch(e) { next(e); }
});
router.put('/enabled', async (req,res,next) => {
  try {
    if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ error: 'Нужно логическое значение enabled' });
    await prisma.setting.upsert({ where: { key: 'gamification_seasons_enabled' }, create: { key: 'gamification_seasons_enabled', value: String(req.body.enabled) }, update: { value: String(req.body.enabled) } });
    res.json({ enabled: req.body.enabled });
  } catch(e) { next(e); }
});
const fields = body => {
  const title = String(body.title ?? '').trim();
  const slug = String(body.slug ?? '').trim();
  const description = String(body.description ?? '');
  const rules = String(body.rules ?? '');
  const rewards = String(body.rewards ?? '');
  const startsAt = new Date(body.startsAt), endsAt = new Date(body.endsAt);
  if (!title || title.length > 100 || !/^[a-z0-9-]{3,60}$/.test(slug) || description.length > 2000 || rules.length > 10000 || rewards.length > 5000 || !Number.isFinite(+startsAt) || !Number.isFinite(+endsAt) || startsAt >= endsAt || typeof body.enabled !== 'boolean') return null;
  return { title, slug, description, rules, rewards, startsAt, endsAt, enabled: body.enabled };
};
async function overlaps(data, excludeId) {
  return prisma.gamificationSeason.count({ where: { ...(excludeId ? { id: { not: excludeId } } : {}), startsAt: { lt: data.endsAt }, endsAt: { gt: data.startsAt } } });
}
router.post('/', async (req,res,next) => {
  try {
    const data = fields(req.body || {});
    if (!data) return res.status(400).json({ error: 'Проверьте поля и даты сезона' });
    if (await overlaps(data)) return res.status(409).json({ error: 'Даты пересекаются с другим сезоном' });
    const season = await prisma.gamificationSeason.create({ data });
    res.status(201).json({ season });
  } catch(e) { next(e); }
});
router.put('/:id', async (req,res,next) => {
  try {
    const data = fields(req.body || {});
    if (!data) return res.status(400).json({ error: 'Проверьте поля и даты сезона' });
    const current = await prisma.gamificationSeason.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'Сезон не найден' });
    if (await overlaps(data, current.id)) return res.status(409).json({ error: 'Даты пересекаются с другим сезоном' });
    const season = await prisma.gamificationSeason.update({ where: { id: current.id }, data });
    res.json({ season });
  } catch(e) { next(e); }
});
// Tasks can be edited while preserving their identity and existing submissions.
router.get('/:id/challenges',async(req,res,next)=>{
 try {const season=await prisma.gamificationSeason.findUnique({where:{id:req.params.id}});if(!season)return res.status(404).json({error:'Сезон не найден'});
 const challenges=await prisma.seasonChallenge.findMany({where:{seasonId:season.id},include:{_count:{select:{submissions:true}}},orderBy:{number:'asc'}});res.json({challenges});}catch(e){next(e)}
});
const taskFields=body=>{
 const number=Number(body.number),type=body.type,title=String(body.title??'').trim(),brief=String(body.brief??'').trim(),criteria=String(body.criteria??'');
 if(!Number.isInteger(number)||number<1||number>1000||!['PHOTO','VIDEO'].includes(type)||!title||title.length>160||!brief||brief.length>4000||criteria.length>2000||typeof body.active!=='boolean')return null;
 return {number,type,title,brief,criteria,active:body.active};
};
router.post('/:id/challenges',async(req,res,next)=>{
 try {if(!await prisma.gamificationSeason.findUnique({where:{id:req.params.id}}))return res.status(404).json({error:'Сезон не найден'});
 const data=taskFields(req.body||{});if(!data)return res.status(400).json({error:'Некорректные поля задания'});
 const challenge=await prisma.seasonChallenge.create({data:{...data,seasonId:req.params.id}});res.status(201).json({challenge});}catch(e){if(e.code==='P2002')return res.status(409).json({error:'Номер задания уже занят'});next(e)}
});
router.put('/:id/challenges/:challengeId',async(req,res,next)=>{
 try {const current=await prisma.seasonChallenge.findFirst({where:{id:req.params.challengeId,seasonId:req.params.id},include:{_count:{select:{submissions:true}}}});
 if(!current)return res.status(404).json({error:'Задание не найдено'});
 const data=taskFields(req.body||{});if(!data)return res.status(400).json({error:'Некорректные поля задания'});
 if(current._count.submissions>0&&!data.active)return res.status(409).json({error:'Нельзя скрыть задание, уже закреплённое за участником'});
 const challenge=await prisma.seasonChallenge.update({where:{id:current.id},data});res.json({challenge});}catch(e){if(e.code==='P2002')return res.status(409).json({error:'Номер задания уже занят'});next(e)}
});
router.delete('/:id/challenges/:challengeId',async(req,res,next)=>{
 try {const current=await prisma.seasonChallenge.findFirst({where:{id:req.params.challengeId,seasonId:req.params.id},include:{_count:{select:{submissions:true}}}});
 if(!current)return res.status(404).json({error:'Задание не найдено'});
 if(current._count.submissions)return res.status(409).json({error:'Нельзя удалить задание, закреплённое за участником'});
 await prisma.seasonChallenge.delete({where:{id:current.id}});res.json({ok:true});}catch(e){next(e)}
});
export default router;
