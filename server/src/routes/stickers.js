import {Router} from 'express';
import {auth} from '../middleware/auth.js';
import {prisma} from '../lib/prisma.js';
const router=Router();router.use(auth);
router.get('/catalog',async(req,res,next)=>{try{
 const [packs,owned]=await Promise.all([prisma.stickerPack.findMany({where:{active:true},include:{stickers:{where:{active:true},orderBy:{number:'asc'}}},orderBy:{title:'asc'}}),prisma.stickerInventory.findMany({where:{userId:req.user.id,quantity:{gt:0}},select:{stickerId:true,quantity:true}})]);
 const quantities=new Map(owned.map(x=>[x.stickerId,x.quantity]));
 res.json({packs:packs.map(p=>({...p,stickers:p.stickers.map(s=>({...s,quantity:quantities.get(s.id)||0}))}))});
 }catch(e){next(e)}});
router.get('/my',async(req,res,next)=>{try{const inventory=await prisma.stickerInventory.findMany({where:{userId:req.user.id,quantity:{gt:0}},include:{sticker:{include:{pack:true}}}});res.json({inventory})}catch(e){next(e)}});
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

// Admin catalog editor: existing stickers can be renamed and hidden without destroying inventories.
router.put('/admin/packs/:id',async(req,res,next)=>{if(req.user.role!=='ADMIN')return res.status(403).json({error:'Нет доступа'});try{
 const {title,description,active}=req.body||{};if(typeof title!=='string'||!title.trim()||title.length>100||typeof description!=='string'||description.length>500||typeof active!=='boolean')return res.status(400).json({error:'Некорректные поля набора'});
 const pack=await prisma.stickerPack.update({where:{id:req.params.id},data:{title:title.trim(),description,active}});res.json({pack});
 }catch(e){if(e.code==='P2025')return res.status(404).json({error:'Набор не найден'});next(e)}});
router.put('/admin/stickers/:id',async(req,res,next)=>{if(req.user.role!=='ADMIN')return res.status(403).json({error:'Нет доступа'});try{
 const {title,emoji,rarity,active}=req.body||{};if(typeof title!=='string'||!title.trim()||title.length>100||typeof emoji!=='string'||!emoji.trim()||emoji.length>24||!['COMMON','RARE','EPIC','LEGENDARY'].includes(rarity)||typeof active!=='boolean')return res.status(400).json({error:'Некорректные поля стикера'});
 const sticker=await prisma.sticker.update({where:{id:req.params.id},data:{title:title.trim(),emoji,rarity,active}});res.json({sticker});
 }catch(e){if(e.code==='P2025')return res.status(404).json({error:'Стикер не найден'});next(e)}});
router.get('/admin/catalog',async(req,res,next)=>{if(req.user.role!=='ADMIN')return res.status(403).json({error:'Нет доступа'});try{const packs=await prisma.stickerPack.findMany({include:{stickers:{orderBy:{number:'asc'}}},orderBy:{title:'asc'}});res.json({packs})}catch(e){next(e)}});
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

export default router;
