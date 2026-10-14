import { prisma } from './prisma.js';

const GENERAL_CHAT_SETTING = 'general_student_chat_id';
export async function getGeneralStudentChatId() {
 const row=await prisma.setting.findUnique({where:{key:GENERAL_CHAT_SETTING}});
 return row?.value||null;
}
export async function ensureStudentGeneralChatMembership(userId) {
 const chatId=await getGeneralStudentChatId();
 if(!chatId)return {status:'not_configured'};
 const [user,chat]=await Promise.all([
   prisma.user.findUnique({where:{id:userId},select:{id:true,role:true,isBanned:true}}),
   prisma.chat.findUnique({where:{id:chatId},select:{id:true,type:true}}),
 ]);
 if(!user||user.role!=='STUDENT'||user.isBanned)return {status:'not_eligible'};
 if(!chat||chat.type!=='GROUP')return {status:'invalid_chat'};
 await prisma.chatMember.upsert({
   where:{chatId_userId:{chatId,userId}},
   create:{chatId,userId,role:'member'},
   update:{},
 });
 return {status:'ok',chatId};
}
export async function syncStudentGeneralChat(chatId){
 const chat=await prisma.chat.findUnique({where:{id:chatId},select:{id:true,type:true}});
 if(!chat||chat.type!=='GROUP')throw Object.assign(new Error('Выберите существующий групповой чат'),{status:400});
 const students=await prisma.user.findMany({where:{role:'STUDENT',isBanned:false},select:{id:true}});
 const existing=await prisma.chatMember.findMany({where:{chatId},select:{userId:true}});
 const present=new Set(existing.map(m=>m.userId));
 const missing=students.filter(s=>!present.has(s.id));
 // createMany skips concurrent duplicate memberships thanks to @@unique(chatId,userId)
 for(let i=0;i<missing.length;i+=250){
   await prisma.chatMember.createMany({data:missing.slice(i,i+250).map(s=>({chatId,userId:s.id,role:'member'})),skipDuplicates:true});
 }
 return {eligible:students.length,added:missing.length,alreadyPresent:students.length-missing.length,chatId};
}
export async function configureStudentGeneralChat(chatId){
 if(chatId!==null){
   const chat=await prisma.chat.findUnique({where:{id:chatId},select:{id:true,type:true}});
   if(!chat||chat.type!=='GROUP')throw Object.assign(new Error('Нужен существующий групповой чат'),{status:400});
 }
 await prisma.setting.upsert({
   where:{key:GENERAL_CHAT_SETTING},create:{key:GENERAL_CHAT_SETTING,value:chatId||''},
   update:{value:chatId||''},
 });
 return chatId?syncStudentGeneralChat(chatId):{eligible:0,added:0,alreadyPresent:0,chatId:null};
}
