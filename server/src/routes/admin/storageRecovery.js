import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../lib/prisma.js';
import sharp from 'sharp';
import { safe } from './_shared.js';
const router=Router();
const ROOTS={library:path.resolve(process.env.EDITORIAL_LIBRARY_DIR||'uploads/editorial'),materials:path.resolve(process.env.EDITORIAL_MATERIAL_DIR||'private/editorial-materials')};
const key=(type,name)=>'storage_review_'+type+'_'+name;
const valid=(type,name)=>Object.hasOwn(ROOTS,type)&&typeof name==='string'&&
 (/^[a-zA-Z0-9_-]{1,160}$/.test(name)||/^[a-zA-Z0-9_-]{1,160}\.webp$/.test(name));
const isPreview=name=>name.endsWith('.webp');
const diskPath=(type,name)=>path.join(ROOTS[type],isPreview(name)?'thumbnails':'',name);
async function inspect(type,filename){
 const stat=await fs.stat(diskPath(type,filename)).catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
 if(!stat?.isFile())return {health:'missing',reason:'Файл отсутствует на диске'};
 if(!stat.size)return {health:'corrupt',reason:'Пустой файл (0 байт)'};
 const image=isPreview(filename);
 if(image){
  try{const meta=await sharp(diskPath(type,filename),{limitInputPixels:80_000_000}).metadata();
    if(!meta.width||!meta.height)throw Error('Нет размеров изображения');
    return {health:'ok',reason:'Миниатюра читается',size:stat.size};
  }catch{return {health:'corrupt',reason:'Повреждённое превью',size:stat.size};}
 }
 return {health:'unknown',reason:'Оригинал существует; целостность содержимого не подтверждена',size:stat.size};
}
const log=(req,action,details)=>prisma.adminAction.create({data:{adminId:req.user.id,action:'storage_'+action,payload:JSON.stringify(details),affected:1}});
router.get('/review',safe(async(_req,res)=>{
 const rows=await prisma.setting.findMany({where:{key:{startsWith:'storage_review_'}}});
 res.json(rows.map(row=>{try{return JSON.parse(row.value);}catch{return null;}}).filter(Boolean));
}));
router.get('/options',safe(async(_req,res)=>{
 const [users,tasks]=await Promise.all([
  prisma.user.findMany({where:{isBanned:false},select:{id:true,fullName:true,username:true},orderBy:{fullName:'asc'},take:500}),
  prisma.editorialTask.findMany({select:{id:true,title:true,project:{select:{title:true}}},orderBy:{createdAt:'desc'},take:500}),
 ]);
 res.json({users,tasks:tasks.map(t=>({id:t.id,title:t.title,project:t.project?.title}))});
}));
router.post('/review',safe(async(req,res)=>{
 const {type,filename,decision}=req.body||{};
 if(!valid(type,filename)||!['keep','discard','investigate'].includes(decision))
   return res.status(400).json({error:'Некорректное имя, хранилище или решение'});
 const health=await inspect(type,filename);
 if(health.health==='missing')return res.status(404).json({error:'Файл уже отсутствует'});
 const existing=await prisma[type==='library'?'editorialLibraryFile':'editorialMaterialFile'].findUnique({
   where:{storageName:isPreview(filename)?filename.slice(0,-5):filename}
 });
 if(existing)return res.status(409).json({error:'Файл уже связан с записью в базе данных'});
 const record={type,filename,decision,health,reviewedBy:req.user.id,reviewedAt:new Date().toISOString()};
 await prisma.setting.upsert({where:{key:key(type,filename)},create:{key:key(type,filename),value:JSON.stringify(record)},update:{value:JSON.stringify(record)}});
 await log(req,'review',record);res.json(record);
}));
router.post('/analyze',safe(async(req,res)=>{
 const items=req.body?.items;
 if(!Array.isArray(items)||!items.length||items.length>100)return res.status(400).json({error:'Выберите от 1 до 100 файлов'});
 const result=[];
 for(const item of items){
  const {type,filename}=item||{};
  if(!valid(type,filename)){result.push({type,filename,health:'invalid',recommendation:'investigate'});continue;}
  const health=await inspect(type,filename);
  const registered=await prisma[type==='library'?'editorialLibraryFile':'editorialMaterialFile'].findUnique({
    where:{storageName:isPreview(filename)?filename.slice(0,-5):filename},select:{id:true}
  });
  const recommendation=registered?'linked':health.health==='corrupt'?'discard': 'investigate';
  result.push({type,filename,...health,registered:!!registered,recommendation});
 }
 res.json({results:result});
}));
router.post('/recover',safe(async(req,res)=>{
 const {type,filename,name,uploaderId,taskId,mimeType}=req.body||{};
 if(!valid(type,filename)||!name||typeof name!=='string'||name.trim().length>255)return res.status(400).json({error:'Укажите название файла'});
 if(isPreview(filename))return res.status(400).json({error:'Превью нельзя зарегистрировать как оригинал'});
 if(typeof uploaderId!=='string')return res.status(400).json({error:'Укажите владельца'});
 if(type==='materials'&&typeof taskId!=='string')return res.status(400).json({error:'Укажите задание'});
 const owner=await prisma.user.findUnique({where:{id:uploaderId},select:{id:true}});
 if(!owner)return res.status(400).json({error:'Владелец не найден'});
 if(type==='materials'&&!(await prisma.editorialTask.findUnique({where:{id:taskId},select:{id:true}})))return res.status(400).json({error:'Задание не найдено'});
 const model=type==='library'?prisma.editorialLibraryFile:prisma.editorialMaterialFile;
 if(await model.findUnique({where:{storageName:filename}}))return res.status(409).json({error:'Файл уже зарегистрирован'});
 const pathname=diskPath(type,filename);
 const stat=await fs.stat(pathname).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 if(!stat?.isFile())return res.status(404).json({error:'Оригинал не найден'});
 const info={name:name.trim(),storageName:filename,mimeType:typeof mimeType==='string'&&mimeType.length<120?mimeType:'application/octet-stream',size:stat.size,uploaderId};
 const saved=type==='library'
 ? await prisma.editorialLibraryFile.create({data:info})
 : await prisma.editorialMaterialFile.create({data:{...info,taskId,version:1}});
 await prisma.setting.deleteMany({where:{key:key(type,filename)}});
 await log(req,'recover',{type,filename,fileId:saved.id,taskId:taskId||null});
 res.json({ok:true,fileId:saved.id});
}));
export default router;