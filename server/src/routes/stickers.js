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
export default router;
