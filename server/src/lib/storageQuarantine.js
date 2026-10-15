import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from './prisma.js';

const root=path.resolve(process.env.EDITORIAL_LIBRARY_DIR || 'uploads/editorial');
const settingKey=id=>'storage_quarantine_'+id;
const active=share=>!share.revokedAt&&(!share.expiresAt||new Date(share.expiresAt).getTime()>Date.now());
export async function quarantineLibraryFile(file,userId){
 const shares=await prisma.editorialFileShare.findMany({where:{revokedAt:null},select:{id:true,fileIds:true,expiresAt:true}});
 const linked=shares.filter(share=>active(share)&&Array.isArray(share.fileIds)&&share.fileIds.includes(file.id));
 if(linked.length){
   const error=new Error('Файл используется в активных публичных подборках. Сначала отзовите ссылки.');
   error.status=409;throw error;
 }
 const id=randomUUID();
 const folder=path.join(root,'.quarantine');await fs.mkdir(folder,{recursive:true,mode:0o700});
 const destination=path.join(folder,id);
 const original=path.join(root,file.storageName);
 const thumb=path.join(root,'thumbnails',file.storageName+'.webp');
 const thumbnailDestination=path.join(folder,id+'.webp');
 await fs.rename(original,destination);
 let thumbnailMoved=false;
 try{
   try{await fs.rename(thumb,thumbnailDestination);thumbnailMoved=true;}catch(error){if(error.code!=='ENOENT')throw error;}
   const item={id,type:'library',filename:file.storageName,name:file.name,size:file.size,
    originalId:file.id,mimeType:file.mimeType,description:file.description,uploaderId:file.uploaderId,originalCreatedAt:file.createdAt,
    thumbnailMoved,by:userId,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+30*86400000).toISOString()};
   await prisma.$transaction([
     prisma.setting.create({data:{key:settingKey(id),value:JSON.stringify(item)}}),
     prisma.editorialLibraryFile.delete({where:{id:file.id}}),
   ]);
   await prisma.adminAction.create({data:{adminId:userId,action:'storage_quarantine_library',payload:JSON.stringify(item),affected:1}}).catch(e=>console.error('[storage] action log failed',e));
   return item;
 }catch(error){
   await fs.rename(destination,original).catch(e=>console.error('[storage] failed to undo quarantine',e));
   if(thumbnailMoved)await fs.rename(thumbnailDestination,thumb).catch(e=>console.error('[storage] failed to undo thumbnail move',e));
   throw error;
 }
}
export async function restoreRegisteredLibraryFile(item){
 const quarantine=path.join(root,'.quarantine',item.id);
 const original=path.join(root,item.filename);
 const exists=async file=>fs.stat(file).then(()=>true).catch(e=>{if(e.code==='ENOENT')return false;throw e;});
 if(await exists(original))throw Object.assign(new Error('Оригинал с таким именем уже существует'),{status:409});
 if(await prisma.editorialLibraryFile.findUnique({where:{id:item.originalId}}))throw Object.assign(new Error('Запись уже восстановлена'),{status:409});
 await fs.rename(quarantine,original);
 const thumbnail=path.join(root,'thumbnails',item.filename+'.webp');
 const srcThumb=path.join(root,'.quarantine',item.id+'.webp');
 let thumbMoved=false;
 try{
   if(item.thumbnailMoved){
     await fs.mkdir(path.dirname(thumbnail),{recursive:true});
     if(await exists(thumbnail))throw Object.assign(new Error('Превью с таким именем уже существует'),{status:409});
     await fs.rename(srcThumb,thumbnail);thumbMoved=true;
   }
   await prisma.$transaction([
     prisma.editorialLibraryFile.create({data:{id:item.originalId,name:item.name,storageName:item.filename,
      mimeType:item.mimeType,size:item.size,description:item.description||'',uploaderId:item.uploaderId,createdAt:new Date(item.originalCreatedAt)}}),
     prisma.setting.delete({where:{key:settingKey(item.id)}}),
   ]);
 }catch(error){
   await fs.rename(original,quarantine).catch(()=>{});
   if(thumbMoved)await fs.rename(thumbnail,srcThumb).catch(()=>{});
   throw error;
 }
}
export async function deleteQuarantinedThumb(item){
 const folder=item.type==='materials'?materialRoot:root;
 if(item.thumbnailMoved)await fs.unlink(path.join(folder,'.quarantine',item.id+'.webp')).catch(e=>{if(e.code!=='ENOENT')throw e;});
}

const materialRoot=path.resolve(process.env.EDITORIAL_MATERIAL_DIR || 'private/editorial-materials');
/**
 * A deleted task/project cannot own files anymore. Preserve original bytes for 30 days
 * as detached material files, recoverable to the original material directory.
 * The administrator must reattach a restored file to a new task if needed.
 */
export async function quarantineDetachedMaterials(files,userId,context={}){
 const result={quarantined:[],failed:[]};
 const folder=path.join(materialRoot,'.quarantine');
 await fs.mkdir(folder,{recursive:true,mode:0o700});
 for(const f of files){
   const id=randomUUID(),source=path.join(materialRoot,f.storageName),destination=path.join(folder,id);
   const thumb=path.join(materialRoot,'thumbnails',f.storageName+'.webp'),thumbDest=path.join(folder,id+'.webp');
   let moved=false,thumbMoved=false;
   try{
     await fs.rename(source,destination);moved=true;
     try{await fs.rename(thumb,thumbDest);thumbMoved=true;}catch(err){if(err.code!=='ENOENT')throw err;}
     const item={id,type:'materials',filename:f.storageName,name:f.name||f.storageName,size:f.size||0,
       mimeType:f.mimeType||'',sourceId:f.id,taskId:f.taskId||context.taskId,projectId:context.projectId,
       originalDeleted:true,thumbnailMoved:thumbMoved,by:userId,createdAt:new Date().toISOString(),
       expiresAt:new Date(Date.now()+30*86400000).toISOString()};
     await prisma.setting.create({data:{key:settingKey(id),value:JSON.stringify(item)}});
     result.quarantined.push(item.id);
   }catch(error){
     if(moved)await fs.rename(destination,source).catch(()=>{});
     if(thumbMoved)await fs.rename(thumbDest,thumb).catch(()=>{});
     result.failed.push({filename:f.storageName,error:error.message});
   }
 }
 await prisma.adminAction.create({data:{adminId:userId,action:'storage_materials_detached',payload:JSON.stringify({...context,...result}),
   affected:result.quarantined.length}}).catch(error=>console.error('[storage] failed to log detached materials',error));
 return result;
}

/**
 * Quarantine an individual task material while preserving the task/project.
 * Refuse files in active public shares. The caller must validate project/task status.
 */
export async function quarantineTaskMaterialFile(file,userId,context={}){
 const fileKey='material:'+file.id;
 const shares=await prisma.editorialFileShare.findMany({where:{revokedAt:null},select:{fileIds:true,expiresAt:true}});
 if(shares.some(share=>active(share)&&Array.isArray(share.fileIds)&&share.fileIds.includes(fileKey))){
   throw Object.assign(new Error('Материал используется в активной общей ссылке. Сначала отзовите её.'),{status:409});
 }
 const folder=path.join(materialRoot,'.quarantine');
 await fs.mkdir(folder,{recursive:true,mode:0o700});
 const id=randomUUID();
 const source=path.join(materialRoot,file.storageName),destination=path.join(folder,id);
 const sourceThumb=path.join(materialRoot,'thumbnails',file.storageName+'.webp');
 const destThumb=path.join(folder,id+'.webp');
 await fs.rename(source,destination);
 let thumbMoved=false;
 try{
   try{await fs.rename(sourceThumb,destThumb);thumbMoved=true;}catch(error){if(error.code!=='ENOENT')throw error;}
   const item={id,type:'materials',filename:file.storageName,name:file.name,size:file.size,mimeType:file.mimeType,
     sourceId:file.id,taskId:file.taskId,projectId:context.projectId,
     version:file.version,caption:file.caption,uploaderId:file.uploaderId,originalCreatedAt:file.createdAt,
     originalDeleted:true,thumbnailMoved:thumbMoved,by:userId,createdAt:new Date().toISOString(),
     expiresAt:new Date(Date.now()+30*86400000).toISOString()};
   await prisma.$transaction([
     prisma.setting.create({data:{key:settingKey(id),value:JSON.stringify(item)}}),
     prisma.editorialMaterialFile.delete({where:{id:file.id}}),
   ]);
   await prisma.adminAction.create({data:{adminId:userId,action:'storage_quarantine_material',payload:JSON.stringify(item),affected:1}}).catch(error=>console.error('[storage] audit failed',error));
   return item;
 }catch(error){
   await fs.rename(destination,source).catch(e=>console.error('[storage] rollback original failed',e));
   if(thumbMoved)await fs.rename(destThumb,sourceThumb).catch(e=>console.error('[storage] rollback thumbnail failed',e));
   throw error;
 }
}
