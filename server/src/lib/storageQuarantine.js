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
 if(item.thumbnailMoved)await fs.unlink(path.join(root,'.quarantine',item.id+'.webp')).catch(e=>{if(e.code!=='ENOENT')throw e;});
}
