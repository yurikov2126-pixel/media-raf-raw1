import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(auth);
const root = path.resolve(process.env.SEASON_WORK_DIR || 'private/season-works');
const allowed = new Set(['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']);
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:200*1024*1024,files:1}});
const admin = req => req.user.role === 'ADMIN';
const validSeason = async slug => {
  const flag=await prisma.setting.findUnique({where:{key:'gamification_seasons_enabled'}});
  if(flag?.value==='false') return null;
  return prisma.gamificationSeason.findFirst({where:{slug,enabled:true}});
};
router.get('/:slug/challenges',async(req,res,next)=>{
  try {const season=await validSeason(req.params.slug);if(!season)return res.status(404).json({error:'Сезон недоступен'});
    const challenges=await prisma.seasonChallenge.findMany({where:{seasonId:season.id,active:true},orderBy:{number:'asc'}});
    const submission=await prisma.seasonSubmission.findUnique({where:{seasonId_userId:{seasonId:season.id,userId:req.user.id}},include:{files:{select:{id:true,name:true,mimeType:true,size:true}}}});
    res.json({challenges,submission});
  }catch(e){next(e)}
});
router.post('/:slug/submit',async(req,res,next)=>{
  try {
    const season=await validSeason(req.params.slug),now=new Date();
    if(!season||now<season.startsAt||now>=season.endsAt)return res.status(409).json({error:'Приём работ в этом сезоне закрыт'});
    const {challengeId,description=''}=req.body||{};
    if(typeof description!=='string'||description.length>3000)return res.status(400).json({error:'Описание слишком длинное'});
    const challenge=await prisma.seasonChallenge.findFirst({where:{id:challengeId,seasonId:season.id,active:true}});
    if(!challenge)return res.status(400).json({error:'Выберите задание'});
    const old=await prisma.seasonSubmission.findUnique({where:{seasonId_userId:{seasonId:season.id,userId:req.user.id}}});
    if(old&&old.status!=='REVISION')return res.status(409).json({error:'Работа уже отправлена на проверку'});
    if(old&&old.challengeId!==challenge.id)return res.status(409).json({error:'При доработке нельзя менять задание'});
    const submission=old?await prisma.seasonSubmission.update({where:{id:old.id},data:{description,status:'SUBMITTED',score:null,feedback:'',reviewedAt:null}}):await prisma.seasonSubmission.create({data:{seasonId:season.id,challengeId:challenge.id,userId:req.user.id,description}});
    res.json({submission});
  }catch(e){next(e)}
});
router.post('/:slug/files',upload.single('file'),async(req,res,next)=>{
  try {
    const season=await validSeason(req.params.slug),now=new Date();
    if(!season||now<season.startsAt||now>=season.endsAt)return res.status(409).json({error:'Приём файлов закрыт'});
    const submission=await prisma.seasonSubmission.findUnique({where:{seasonId_userId:{seasonId:season.id,userId:req.user.id}},include:{files:true}});
    if(!submission||submission.status!=='SUBMITTED')return res.status(409).json({error:'Сначала отправьте заявку'});
    if(submission.files.length>=10)return res.status(400).json({error:'Не более 10 файлов'});
    if(!req.file||!allowed.has(req.file.mimetype))return res.status(400).json({error:'Поддерживаются JPEG, PNG, WebP, MP4, WebM, MOV'});
    await fs.mkdir(root,{recursive:true});const storageName=randomUUID();
    await fs.writeFile(path.join(root,storageName),req.file.buffer,{flag:'wx'});
    try {const file=await prisma.seasonSubmissionFile.create({data:{submissionId:submission.id,name:path.basename(req.file.originalname).slice(0,255),mimeType:req.file.mimetype,size:req.file.size,storageName}});res.status(201).json({file:{id:file.id,name:file.name,mimeType:file.mimeType,size:file.size}})}
    catch(e){await fs.unlink(path.join(root,storageName)).catch(()=>{});throw e}
  }catch(e){next(e)}
});
router.get('/files/:fileId',async(req,res,next)=>{
  try {const file=await prisma.seasonSubmissionFile.findUnique({where:{id:req.params.fileId},include:{submission:true}});
    if(!file||(file.submission.userId!==req.user.id&&!admin(req)))return res.status(404).end();
    res.type(file.mimeType);res.setHeader('Content-Disposition','inline; filename="work"');
    res.sendFile(path.join(root,file.storageName),err=>{if(err&&!res.headersSent)next(err)});
  }catch(e){next(e)}
});
// Final standings: approved creative work is mandatory. Creative score 70%, participation XP 30%.
// Participation is capped at 1000 XP for transparent, stable normalization.
router.get('/:slug/results',async(req,res,next)=>{
  try {const season=await validSeason(req.params.slug);if(!season)return res.status(404).json({error:'Сезон недоступен'});
    const approved=await prisma.seasonSubmission.findMany({where:{seasonId:season.id,status:'APPROVED'},include:{user:{select:{id:true,username:true,fullName:true}}}});
    const sums=await prisma.xpLog.groupBy({by:['userId'],where:{userId:{in:approved.map(s=>s.userId)},createdAt:{gte:season.startsAt,lt:season.endsAt}},_sum:{amount:true}});
    const xpMap=new Map(sums.map(x=>[x.userId,Math.max(0,x._sum.amount||0)]));
    const items=approved.map(s=>{const xp=xpMap.get(s.userId)||0;return {user:s.user,creativeScore:s.score||0,xp,finalScore:Math.round((s.score||0)*0.7+Math.min(100,xp/10)*0.3),prize:s.prize}}).sort((a,b)=>b.finalScore-a.finalScore||b.creativeScore-a.creativeScore||b.xp-a.xp);
    res.json({items:items.map((item,i)=>({...item,rank:i+1})),formula:'70% creative + 30% XP (1000 XP cap)'});
  }catch(e){next(e)}
});
router.get('/admin/submissions',async(req,res,next)=>{
  if(!admin(req))return res.status(403).json({error:'Только администратору'});
  try {const submissions=await prisma.seasonSubmission.findMany({include:{user:{select:{id:true,fullName:true,username:true}},challenge:{select:{title:true,type:true}},season:{select:{title:true}},files:{select:{id:true,name:true,mimeType:true,size:true}}},orderBy:{submittedAt:'desc'},take:500});res.json({submissions})}catch(e){next(e)}
});
router.patch('/admin/submissions/:id',async(req,res,next)=>{
  if(!admin(req))return res.status(403).json({error:'Только администратору'});
  try {const {status,score,feedback='',prize=''}=req.body||{};
    if(!['REVISION','APPROVED','REJECTED'].includes(status)||typeof feedback!=='string'||feedback.length>3000||typeof prize!=='string'||prize.length>1000||((status==='APPROVED')&&(!Number.isInteger(score)||score<0||score>100)))return res.status(400).json({error:'Проверьте оценку, статус и комментарий'});
    const current=await prisma.seasonSubmission.findUnique({where:{id:req.params.id},include:{files:true}});
    if(!current)return res.status(404).json({error:'Работа не найдена'});
    if(status==='APPROVED'&&!current.files.length)return res.status(409).json({error:'Нельзя принять работу без файлов'});
    const submission=await prisma.seasonSubmission.update({where:{id:current.id},data:{status,score:status==='APPROVED'?score:null,feedback,prize:status==='APPROVED'?prize:'',reviewedAt:new Date()}});
    await prisma.notification.create({data:{userId:current.userId,type:'season_review',payload:JSON.stringify({seasonId:current.seasonId,status,score:submission.score,prize:submission.prize})}});
    res.json({submission});
  }catch(e){next(e)}
});
export default router;
