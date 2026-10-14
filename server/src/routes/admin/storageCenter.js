import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { safe } from './_shared.js';
import { restoreRegisteredLibraryFile, deleteQuarantinedThumb } from '../../lib/storageQuarantine.js';

const router = Router();
const ROOTS = {
  library: path.resolve(process.env.EDITORIAL_LIBRARY_DIR || 'uploads/editorial'),
  materials: path.resolve(process.env.EDITORIAL_MATERIAL_DIR || 'private/editorial-materials'),
};
const MODEL = { library: 'editorialLibraryFile', materials: 'editorialMaterialFile' };
const RETENTION_DAYS = 30;
const KEY = id => 'storage_quarantine_' + id;
const metaName = name => /^[a-zA-Z0-9_-]{1,160}$/.test(name);
const rootFor = type => ROOTS[type];
const location = (type, filename) => {
  if (!rootFor(type) || !metaName(filename)) throw Object.assign(new Error('Недопустимый путь'), { status: 400 });
  return path.join(ROOTS[type], filename);
};
const exists = async location => fs.stat(location).then(s => s.isFile() ? s : null).catch(e => { if(e.code === 'ENOENT') return null; throw e; });
const owned = (share, id, type) => Array.isArray(share.fileIds) &&
    share.fileIds.includes(type === 'materials' ? 'material:' + id : id);
const shareActive = share => !share.revokedAt && (!share.expiresAt || new Date(share.expiresAt).getTime() > Date.now());
const record = (req, action, payload, affected = 1) => prisma.adminAction.create({
  data: { adminId: req.user.id, action: 'storage_' + action, payload: JSON.stringify(payload), affected },
});
const filterInfo = (q, rows) => rows.filter(f =>
  (!q || [f.name,f.project,f.task,f.storageName].some(v=>String(v || '').toLowerCase().includes(q.toLowerCase()))));
const filesOf = async (type, count) => {
  const root = ROOTS[type];
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(e=>e.code==='ENOENT'?[]:Promise.reject(e));
  return entries.filter(e=>e.isFile()&&metaName(e.name)).slice(0,count).map(e=>e.name);
};
export async function snapshot({ deep = false } = {}) {
  const [library, materials, shares, totals] = await Promise.all([
    prisma.editorialLibraryFile.findMany({ select: { id:true,name:true,mimeType:true,size:true,storageName:true,uploaderId:true,createdAt:true } }),
    prisma.editorialMaterialFile.findMany({ select: { id:true,name:true,mimeType:true,size:true,storageName:true,uploaderId:true,createdAt:true,version:true,taskId:true,task:{select:{ title:true,projectId:true,project:{select:{title:true}} }} } }),
    prisma.editorialFileShare.findMany({select:{id:true,title:true,fileIds:true,createdAt:true,expiresAt:true,revokedAt:true}}),
    prisma.$queryRawUnsafe('SELECT pg_database_size(current_database())::text AS bytes, current_database() AS name'),
  ]);
  const report = [];
  const used = {library:new Set(),materials:new Set()};
  for(const type of ['library','materials']) {
    const originals = type==='library' ? library : materials;
    const root = ROOTS[type];
    for(const f of originals) {
      used[type].add(f.storageName);
      const stat=await exists(location(type,f.storageName));
      const thumb = path.join(root,'thumbnails',f.storageName+'.webp');
      const thumbnail = await exists(thumb);
      const refs=shares.filter(s=>owned(s,f.id,type)).map(s=>({type:'share',id:s.id,title:s.title,active:shareActive(s),expiresAt:s.expiresAt}));
      if(type==='materials')refs.unshift({type:'task',id:f.taskId,title:f.task?.title||'Задание',project:f.task?.project?.title,projectId:f.task?.projectId});
      const issues=[];
      if(!stat) issues.push('missing');
      else if(stat.size!==f.size) issues.push('size_mismatch');
      if(thumbnail && !stat)issues.push('orphan_thumbnail');
      report.push({id:f.id,type,name:f.name,storageName:f.storageName,mimeType:f.mimeType,size:f.size,actualSize:stat?.size??null,
        thumbnail:!!thumbnail,thumbnailBytes:thumbnail?.size||0,createdAt:f.createdAt,project:f.task?.project?.title,
        task:f.task?.title,taskId:f.taskId,projectId:f.task?.projectId,refs,issues,status:issues.length?'problem':'linked',
        recoverable:false});
    }
  }
  const orphan = [];
  for(const type of ['library','materials']) {
    for(const filename of await filesOf(type,deep?100000:15000)){
      if(used[type].has(filename))continue;
      const stat=await exists(location(type,filename));
      if(stat)orphan.push({id:filename,type,name:filename,storageName:filename,size:stat.size,actualSize:stat.size,
        createdAt:stat.birthtime,refs:[],issues:['untracked'],status:'untracked',recoverable:true});
    }
  }
  // Check orphaned previews separately. Preview files are never mistaken for originals.
  for(const type of ['library','materials']) {
    const previewRoot=path.join(ROOTS[type],'thumbnails');
    const entries=await fs.readdir(previewRoot,{withFileTypes:true}).catch(e=>e.code==='ENOENT'?[]:Promise.reject(e));
    const valid=new Set((type==='library'?library:materials).map(f=>f.storageName+'.webp'));
    for(const entry of entries) {
      if(!entry.isFile()||!entry.name.endsWith('.webp')||valid.has(entry.name))continue;
      const original=entry.name.slice(0,-5);
      if(!metaName(original))continue;
      const stat=await exists(path.join(previewRoot,entry.name));
      if(!stat)continue;
      orphan.push({id:'preview:'+entry.name,type,name:entry.name,storageName:entry.name,size:stat.size,
        actualSize:stat.size,refs:[],issues:['orphan_thumbnail'],status:'orphan_preview',recoverable:false});
    }
  }
  const quarantineSettings=await prisma.setting.findMany({where:{key:{startsWith:'storage_quarantine_'}}});
  const quarantine=quarantineSettings.map(x=>{try{return JSON.parse(x.value);}catch{return null;}}).filter(Boolean);
  const size=report.reduce((a,f)=>a+f.size,0),orphanBytes=orphan.reduce((a,f)=>a+f.size,0);
  return {files:[...report,...orphan],quarantine,stats:{registered:report.length,untracked:orphan.filter(f=>f.status==='untracked').length,orphanPreviews:orphan.filter(f=>f.status==='orphan_preview').length,broken:report.filter(f=>f.issues.length).length,
    registeredBytes:size,untrackedBytes:orphan.filter(f=>f.status==='untracked').reduce((a,f)=>a+f.size,0),orphanPreviewBytes:orphan.filter(f=>f.status==='orphan_preview').reduce((a,f)=>a+f.size,0),quarantineCount:quarantine.length,quarantineBytes:quarantine.reduce((a,f)=>a+(f.size||0),0),
    databaseBytes:Number(totals[0]?.bytes||0),databaseName:totals[0]?.name||null},
    shares:shares.map(s=>({id:s.id,title:s.title,active:shareActive(s),count:Array.isArray(s.fileIds)?s.fileIds.length:0})),
    checkedAt:new Date().toISOString()};
}
router.get('/overview',safe(async(req,res)=>{
 const data=await snapshot();res.set('Cache-Control','no-store');res.json(data);
}));
router.get('/database',safe(async(_req,res)=>{
 const [tables,db]=await Promise.all([
   prisma.$queryRawUnsafe("SELECT relname AS name, pg_total_relation_size(relid)::text AS bytes, n_live_tup::text AS rows FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 30"),
   prisma.$queryRawUnsafe("SELECT pg_database_size(current_database())::text AS bytes, current_database() AS name"),
 ]);
 res.json({name:db[0]?.name,bytes:Number(db[0]?.bytes||0),tables:tables.map(t=>({...t,bytes:Number(t.bytes),rows:Number(t.rows)}))});
}));
router.get('/history',safe(async(req,res)=>{
 const rows=await prisma.adminAction.findMany({where:{action:{startsWith:'storage_'}},orderBy:{createdAt:'desc'},take:200});
 res.json(rows.map(r=>({id:r.id,action:r.action,at:r.createdAt,userId:r.adminId,details:JSON.parse(r.payload||'{}')})));
}));
router.post('/audit',safe(async(req,res)=>{
 const data=await snapshot({deep:true});
 await record(req,'audit',{registered:data.stats.registered,untracked:data.stats.untracked,broken:data.stats.broken},0);
 res.json(data);
}));
router.post('/quarantine',safe(async(req,res)=>{
 const {type,filename}=req.body||{};
 const preview=typeof filename==='string'&&filename.endsWith('.webp')&&metaName(filename.slice(0,-5));
 if(!rootFor(type)||(!metaName(filename)&&!preview))return res.status(400).json({error:'Недопустимый файл'});
 const model=MODEL[type],originalName=preview?filename.slice(0,-5):filename;
 const found=await prisma[model].findUnique({where:{storageName:originalName}});
 if(found)return res.status(409).json({error:'Файл или его превью зарегистрированы. Удаление запрещено.'});
 // Always recheck immediately before moving, not merely relying on an earlier audit.
 const scan=await snapshot();
 if(!scan.files.some(f=>f.type===type&&f.storageName===filename&&(f.status==='untracked'||preview&&f.status==='orphan_preview')))
   return res.status(409).json({error:'Файл больше не является свободным'});
 const source=preview?path.join(ROOTS[type],'thumbnails',filename):location(type,filename);
 const stat=await exists(source);
 if(!stat)return res.status(404).json({error:'Файл уже отсутствует'});
 const id=randomUUID(), folder=path.join(ROOTS[type],'.quarantine');
 await fs.mkdir(folder,{recursive:true,mode:0o700});
 const target=path.join(folder,id);
 await fs.rename(source,target);
 const metadata={id,type,filename,preview,size:stat.size,createdAt:new Date().toISOString(),
    expiresAt:new Date(Date.now()+RETENTION_DAYS*86400000).toISOString(),by:req.user.id};
 try{
   await prisma.setting.create({data:{key:KEY(id),value:JSON.stringify(metadata)}});
   await record(req,'quarantine',metadata);
 }catch(e){await fs.rename(target,source).catch(()=>{});throw e;}
 res.json(metadata);
}));
router.post('/restore/:id',safe(async(req,res)=>{
 const key=KEY(req.params.id),row=await prisma.setting.findUnique({where:{key}});
 if(!row)return res.status(404).json({error:'Запись карантина не найдена'});
 const item=JSON.parse(row.value),dest=item.preview?path.join(ROOTS[item.type],'thumbnails',item.filename):location(item.type,item.filename);
 if(await exists(dest))return res.status(409).json({error:'Файл с этим именем уже существует'});
 if(item.originalId) await restoreRegisteredLibraryFile(item);
 else {
   if(item.preview) await fs.mkdir(path.dirname(dest),{recursive:true});
   await fs.rename(path.join(ROOTS[item.type],'.quarantine',item.id),dest);
   await prisma.setting.delete({where:{key}});
 }
 await record(req,'restore',{id:item.id,type:item.type,filename:item.filename});
 res.json({ok:true});
}));
router.post('/purge/:id',safe(async(req,res)=>{
 const key=KEY(req.params.id),row=await prisma.setting.findUnique({where:{key}});
 if(!row)return res.status(404).json({error:'Запись карантина не найдена'});
 const item=JSON.parse(row.value);
 if(new Date(item.expiresAt).getTime()>Date.now())return res.status(409).json({error:'30 дней хранения ещё не истекли'});
 const file=path.join(ROOTS[item.type],'.quarantine',item.id);
 await fs.unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});
 await deleteQuarantinedThumb(item);
 await prisma.setting.delete({where:{key}});
 await record(req,'purge',{id:item.id,filename:item.filename,type:item.type,size:item.size});
 res.json({ok:true});
}));
export default router;
