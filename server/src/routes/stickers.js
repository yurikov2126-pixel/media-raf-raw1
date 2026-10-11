import {Router} from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {auth} from '../middleware/auth.js';
import {prisma} from '../lib/prisma.js';
import {syncStickerRewards} from '../lib/stickerRewards.js';
const router=Router();router.use(auth);
router.get('/rewards/unseen',async(req,res,next)=>{try{
 await syncStickerRewards(req.user.id);
 const awards=await prisma.stickerAutoAward.findMany({where:{userId:req.user.id,seenAt:null},orderBy:{createdAt:'asc'},take:20});
 const stickerIds=[...new Set(awards.map(a=>a.stickerId))];
 const stickers=await prisma.sticker.findMany({where:{id:{in:stickerIds}},include:{pack:{select:{title:true,slug:true}}}});
 const byId=new Map(stickers.map(st=>[st.id,st]));
 res.json({awards:awards.map(a=>({id:a.id,ruleId:a.ruleId,sticker:byId.get(a.stickerId)||null,createdAt:a.createdAt}))});
 }catch(e){next(e)}});
router.post('/rewards/:id/seen',async(req,res,next)=>{try{
 const result=await prisma.stickerAutoAward.updateMany({where:{id:req.params.id,userId:req.user.id,seenAt:null},data:{seenAt:new Date()}});
 res.json({acknowledged:result.count>0});
 }catch(e){next(e)}});
router.get('/catalog',async(req,res,next)=>{try{
 await syncStickerRewards(req.user.id);
 const [packs,owned]=await Promise.all([prisma.stickerPack.findMany({where:{active:true},include:{stickers:{where:{active:true},orderBy:{number:'asc'}}},orderBy:{title:'asc'}}),prisma.stickerInventory.findMany({where:{userId:req.user.id,quantity:{gt:0}},select:{stickerId:true,quantity:true}})]);
 const quantities=new Map(owned.map(x=>[x.stickerId,x.quantity]));
 const isAdmin=req.user.role==='ADMIN';
 res.json({packs:packs.map(p=>({...p,stickers:p.stickers.map(s=>({...s,quantity:quantities.get(s.id)||0,adminUnlocked:isAdmin}))}))});
 }catch(e){next(e)}});
router.get('/my',async(req,res,next)=>{try{
 await syncStickerRewards(req.user.id);const inventory=await prisma.stickerInventory.findMany({where:{userId:req.user.id,quantity:{gt:0}},include:{sticker:{include:{pack:true}}}});res.json({inventory})}catch(e){next(e)}});
router.get('/admin/users',async(req,res,next)=>{if(req.user.role!=='ADMIN')return res.status(403).json({error:'Нет доступа'});try{
 const users=await prisma.user.findMany({select:{id:true,fullName:true,username:true},orderBy:{fullName:'asc'},take:500});res.json({users});
 }catch(e){next(e)}});
router.post('/admin/grant',async(req,res,next)=>{if(req.user.role!=='ADMIN')return res.status(403).json({error:'Нет доступа'});try{
 const {userId,stickerId,quantity,reason=''}=req.body||{};
 if(typeof userId!=='string'||typeof stickerId!=='string'||!Number.isInteger(quantity)||quantity<1||quantity>100||typeof reason!=='string'||reason.length>500)return res.status(400).json({error:'Проверьте получателя, стикер и количество (1–100)'});
 const [user,sticker]=await Promise.all([prisma.user.findUnique({where:{id:userId},select:{id:true}}),prisma.sticker.findUnique({where:{id:stickerId},select:{id:true}})]);
 if(!user||!sticker)return res.status(404).json({error:'Пользователь или стикер не найден'});
 const result=await prisma.$transaction(async tx=>{
 const inventory=await tx.stickerInventory.upsert({where:{userId_stickerId:{userId,stickerId}},create:{userId,stickerId,quantity},update:{quantity:{increment:quantity}}});
 await tx.stickerGrant.create({data:{userId,stickerId,quantity,reason}});return inventory;
 });res.status(201).json({inventory:result});
 }catch(e){next(e)}});
router.get('/admin/grants',async(req,res,next)=>{if(req.user.role!=='ADMIN')return res.status(403).json({error:'Нет доступа'});try{
 const grants=await prisma.stickerGrant.findMany({include:{user:{select:{fullName:true,username:true}},sticker:{select:{title:true,emoji:true}}},orderBy:{createdAt:'desc'},take:100});res.json({grants});
 }catch(e){next(e)}});

// Admin-only artwork upload. Stored in the existing public uploads directory.
const stickerArtUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:3*1024*1024,files:1}});
router.post('/admin/stickers/:id/artwork', (req,res,next)=>{
 if(req.user.role!=='ADMIN')return res.status(403).json({error:'Нет доступа'});
 stickerArtUpload.single('file')(req,res,err=>{if(err)return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'Изображение должно быть не больше 3 МБ':'Ошибка загрузки изображения'});next()});
},async(req,res,next)=>{try{
 const sticker=await prisma.sticker.findUnique({where:{id:req.params.id},select:{id:true,imageUrl:true}});
 if(!sticker)return res.status(404).json({error:'Стикер не найден'});
 const bytes=req.file?.buffer;
 if(!bytes)return res.status(400).json({error:'Выберите изображение'});
 const png=bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!png&&!jpg&&!webp)return res.status(400).json({error:'Поддерживаются только PNG, JPEG и WebP'});
 const ext=png?'png':jpg?'jpg':'webp';
 const root=path.resolve('uploads/stickers');
 await fs.mkdir(root,{recursive:true});
 const name=randomUUID()+'.'+ext;
 const dest=path.join(root,name);
 await fs.writeFile(dest,bytes,{flag:'wx'});
 const imageUrl='/uploads/stickers/'+name;
 try{
  await prisma.sticker.update({where:{id:sticker.id},data:{imageUrl}});
 }catch(e){await fs.unlink(dest).catch(()=>{});throw e}
 // Never remove remote images or arbitrary paths.
 if(sticker.imageUrl?.startsWith('/uploads/stickers/')){
  const previous=path.basename(sticker.imageUrl);
  if(/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(previous))await fs.unlink(path.join(root,previous)).catch(()=>{});
 }
 res.status(201).json({imageUrl});
 }catch(e){next(e)}});

// Admin catalog editor: existing stickers can be renamed and hidden without destroying inventories.
router.put('/admin/packs/:id',async(req,res,next)=>{if(req.user.role!=='ADMIN')return res.status(403).json({error:'Нет доступа'});try{
 const {title,description,active}=req.body||{};if(typeof title!=='string'||!title.trim()||title.length>100||typeof description!=='string'||description.length>500||typeof active!=='boolean')return res.status(400).json({error:'Некорректные поля набора'});
 const pack=await prisma.stickerPack.update({where:{id:req.params.id},data:{title:title.trim(),description,active}});res.json({pack});
 }catch(e){if(e.code==='P2025')return res.status(404).json({error:'Набор не найден'});next(e)}});
router.put('/admin/stickers/:id',async(req,res,next)=>{if(req.user.role!=='ADMIN')return res.status(403).json({error:'Нет доступа'});try{
 const {title,emoji,rarity,active,imageUrl}=req.body||{};if(typeof title!=='string'||!title.trim()||title.length>100||typeof emoji!=='string'||!emoji.trim()||emoji.length>24||!['COMMON','RARE','EPIC','LEGENDARY'].includes(rarity)||typeof active!=='boolean'||(imageUrl!==null&&imageUrl!==undefined&&(typeof imageUrl!=='string'||imageUrl.length>2048||imageUrl!==''&&!/^https:\/\//i.test(imageUrl)&&!/^\/uploads\/stickers\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(imageUrl))))return res.status(400).json({error:'Некорректные поля стикера или ссылка на изображение'});
 const sticker=await prisma.sticker.update({where:{id:req.params.id},data:{title:title.trim(),emoji,rarity,active,...(imageUrl!==undefined?{imageUrl:imageUrl||null}:{})}});res.json({sticker});
 }catch(e){if(e.code==='P2025')return res.status(404).json({error:'Стикер не найден'});next(e)}});
router.get('/admin/catalog',async(req,res,next)=>{if(req.user.role!=='ADMIN')return res.status(403).json({error:'Нет доступа'});try{const packs=await prisma.stickerPack.findMany({include:{stickers:{orderBy:{number:'asc'}}},orderBy:{title:'asc'}});res.json({packs})}catch(e){next(e)}});
router.get('/participants',async(req,res,next)=>{try{const users=await prisma.user.findMany({where:{id:{not:req.user.id},isBanned:false},select:{id:true,fullName:true,username:true},orderBy:{fullName:'asc'},take:500});res.json({users})}catch(e){next(e)}});
router.get('/trades',async(req,res,next)=>{try{const offers=await prisma.stickerTrade.findMany({where:{OR:[{senderId:req.user.id},{receiverId:req.user.id}]},orderBy:{createdAt:'desc'},take:100});res.json({offers})}catch(e){next(e)}});
router.post('/trades',async(req,res,next)=>{try{
 const {receiverId,offeredStickerId,requestedStickerId}=req.body||{};
 if(typeof receiverId!=='string'||typeof offeredStickerId!=='string'||typeof requestedStickerId!=='string'||receiverId===req.user.id||offeredStickerId===requestedStickerId)return res.status(400).json({error:'Проверьте условия обмена'});
 const [receiver,offer,request]=await Promise.all([prisma.user.findUnique({where:{id:receiverId},select:{id:true}}),prisma.stickerInventory.findUnique({where:{userId_stickerId:{userId:req.user.id,stickerId:offeredStickerId}}}),prisma.stickerInventory.findUnique({where:{userId_stickerId:{userId:receiverId,stickerId:requestedStickerId}}})]);
 if(!receiver||!offer||offer.quantity<2||!request||request.quantity<1)return res.status(409).json({error:'Для обмена нужен ваш повторный стикер и экземпляр у получателя'});
 const trade=await prisma.stickerTrade.create({data:{senderId:req.user.id,receiverId,offeredStickerId,requestedStickerId}});res.status(201).json({trade});
 }catch(e){next(e)}});
router.post('/trades/:id/resolve',async(req,res,next)=>{try{
 const action=req.body?.action;if(!['accept','decline','cancel'].includes(action))return res.status(400).json({error:'Неизвестное действие'});
 // Serializable transaction ensures no duplicated sticker transfers under concurrent acceptance.
 const result=await prisma.$transaction(async tx=>{
 const t=await tx.stickerTrade.findUnique({where:{id:req.params.id}});if(!t||t.status!=='PENDING')throw Object.assign(new Error('Предложение недоступно'),{status:409});
 if(action==='cancel'&&t.senderId!==req.user.id||action!=='cancel'&&t.receiverId!==req.user.id)throw Object.assign(new Error('Нет доступа'),{status:403});
 if(action!=='accept')return tx.stickerTrade.update({where:{id:t.id},data:{status:action==='cancel'?'CANCELLED':'DECLINED',resolvedAt:new Date()}});
 const from=await tx.stickerInventory.updateMany({where:{userId:t.senderId,stickerId:t.offeredStickerId,quantity:{gte:2}},data:{quantity:{decrement:1}}});
 if(!from.count)throw Object.assign(new Error('У отправителя больше нет повтора'),{status:409});
 const to=await tx.stickerInventory.updateMany({where:{userId:t.receiverId,stickerId:t.requestedStickerId,quantity:{gte:1}},data:{quantity:{decrement:1}}});
 if(!to.count)throw Object.assign(new Error('У получателя нет запрошенного стикера'),{status:409});
 await tx.stickerInventory.upsert({where:{userId_stickerId:{userId:t.receiverId,stickerId:t.offeredStickerId}},create:{userId:t.receiverId,stickerId:t.offeredStickerId,quantity:1},update:{quantity:{increment:1}}});
 await tx.stickerInventory.upsert({where:{userId_stickerId:{userId:t.senderId,stickerId:t.requestedStickerId}},create:{userId:t.senderId,stickerId:t.requestedStickerId,quantity:1},update:{quantity:{increment:1}}});
 return tx.stickerTrade.update({where:{id:t.id},data:{status:'ACCEPTED',resolvedAt:new Date()}});
 },{isolationLevel:'Serializable'});res.json({trade:result});
 }catch(e){if(e.status)return res.status(e.status).json({error:e.message});if(e.code==='P2034')return res.status(409).json({error:'Конфликт обмена. Повторите действие'});next(e)}});

router.get('/admin/reward-rules',async(req,res,next)=>{if(req.user.role!=='ADMIN')return res.status(403).json({error:'Нет доступа'});try{res.json({rules:await prisma.stickerRewardRule.findMany({orderBy:{event:'asc'}})})}catch(e){next(e)}});
router.put('/admin/reward-rules/:id',async(req,res,next)=>{if(req.user.role!=='ADMIN')return res.status(403).json({error:'Нет доступа'});try{
 const {stickerId,threshold,enabled}=req.body||{};
 if(typeof stickerId!=='string'||!Number.isInteger(threshold)||threshold<1||threshold>100000||typeof enabled!=='boolean')return res.status(400).json({error:'Некорректные настройки награды'});
 const sticker=await prisma.sticker.findUnique({where:{id:stickerId}});if(!sticker)return res.status(404).json({error:'Стикер не найден'});
 const rule=await prisma.stickerRewardRule.update({where:{id:req.params.id},data:{stickerId,threshold,enabled}});res.json({rule});
 }catch(e){if(e.code==='P2025')return res.status(404).json({error:'Правило не найдено'});next(e)}});
export default router;
