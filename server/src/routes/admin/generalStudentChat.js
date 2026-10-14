import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { safe } from './_shared.js';
import { getGeneralStudentChatId,configureStudentGeneralChat,syncStudentGeneralChat } from '../../lib/studentGeneralChat.js';
const router=Router();

router.get('/general-student-chat',safe(async(_req,res)=>{
 const [chatId,chats,studentCount]=await Promise.all([
   getGeneralStudentChatId(),
   prisma.chat.findMany({where:{type:'GROUP'},select:{id:true,title:true,createdAt:true,_count:{select:{members:true}}},orderBy:{createdAt:'asc'}}),
   prisma.user.count({where:{role:'STUDENT',isBanned:false}}),
 ]);
 const selected=chats.find(c=>c.id===chatId);
 const count=chatId?await prisma.chatMember.count({where:{chatId,user:{role:'STUDENT',isBanned:false}}}):0;
 res.json({chatId:selected?.id||null,configured:!!selected,studentCount,currentStudents:count,missing:studentCount-count,
   chats:chats.map(c=>({id:c.id,title:c.title||'Групповой чат без названия',members:c._count.members,createdAt:c.createdAt}))});
}));
router.put('/general-student-chat',safe(async(req,res)=>{
 const chatId=req.body?.chatId;
 if(typeof chatId!=='string'||!chatId.trim())return res.status(400).json({error:'Выберите групповой чат'});
 const synced=await configureStudentGeneralChat(chatId);
 res.json({ok:true,...synced});
}));
router.post('/general-student-chat/sync',safe(async(_req,res)=>{
 const chatId=await getGeneralStudentChatId();
 if(!chatId)return res.status(409).json({error:'Сначала выберите общий чат'});
 res.json({ok:true,...await syncStudentGeneralChat(chatId)});
}));
// Manual additions are independent of the automatic STUDENT policy.
router.get('/general-student-chat/users',safe(async(req,res)=>{
 const query=String(req.query.q||'').trim().slice(0,80);
 const users=await prisma.user.findMany({
  where:{isBanned:false,...(query?{OR:[
   {fullName:{contains:query,mode:'insensitive'}},
   {username:{contains:query,mode:'insensitive'}},
  ]}:{})},
  select:{id:true,fullName:true,username:true,role:true},
  orderBy:{fullName:'asc'},take:80,
 });
 res.json({users});
}));
router.post('/general-student-chat/members',safe(async(req,res)=>{
 const {chatId,userId}=req.body||{};
 if(typeof chatId!=='string'||typeof userId!=='string'||!chatId||!userId)
   return res.status(400).json({error:'Выберите групповой чат и пользователя'});
 const [chat,user]=await Promise.all([
  prisma.chat.findUnique({where:{id:chatId},select:{id:true,type:true}}),
  prisma.user.findUnique({where:{id:userId},select:{id:true,isBanned:true}}),
 ]);
 if(!chat||chat.type!=='GROUP')return res.status(404).json({error:'Групповой чат не найден'});
 if(!user||user.isBanned)return res.status(404).json({error:'Пользователь не найден или заблокирован'});
 const existing=await prisma.chatMember.findUnique({where:{chatId_userId:{chatId,userId}}});
 if(existing)return res.json({ok:true,added:false,message:'Пользователь уже состоит в чате'});
 await prisma.chatMember.createMany({data:[{chatId,userId,role:'member'}],skipDuplicates:true});
 const joined=await prisma.chatMember.findUnique({where:{chatId_userId:{chatId,userId}}});
 res.json({ok:!!joined,added:!!joined});
}));
export default router;
