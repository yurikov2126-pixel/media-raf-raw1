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
export default router;
