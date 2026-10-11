import {prisma} from './prisma.js';

// Idempotent awards. Evaluate real database activity, never trust client counters.
export async function syncStickerRewards(userId){
 const rules=await prisma.stickerRewardRule.findMany({where:{enabled:true}});
 if(!rules.length)return [];
 const needed=new Set(rules.map(r=>r.event));
 const counts={};
 if([...needed].some(e=>e.includes('POST')))counts.posts=await prisma.post.count({where:{authorId:userId}});
 if([...needed].some(e=>e.includes('COMMENT')))counts.comments=await prisma.comment.count({where:{authorId:userId,deletedAt:null}});
 if([...needed].some(e=>e.includes('LESSON')))counts.lessons=await prisma.lessonProgress.count({where:{userId,completed:true}});
 if([...needed].some(e=>e.includes('SEASON')))counts.seasons=await prisma.seasonSubmission.count({where:{userId,status:'APPROVED'}});
 const value=e=>e.includes('POST')?counts.posts:e.includes('COMMENT')?counts.comments:e.includes('LESSON')?counts.lessons:counts.seasons;
 const earned=[];
 for(const rule of rules){
  if((value(rule.event)||0)<rule.threshold)continue;
  const sticker=await prisma.sticker.findFirst({where:{id:rule.stickerId,active:true,pack:{active:true}},select:{id:true,title:true,emoji:true}});
  if(!sticker)continue;
  // The unique ledger prevents repeat grants across concurrent calls.
  try{
   const didGrant=await prisma.$transaction(async tx=>{
    const entry=await tx.stickerAutoAward.createMany({data:[{userId,ruleId:rule.id,stickerId:sticker.id}],skipDuplicates:true});
    if(!entry.count)return false;
    await tx.stickerInventory.upsert({where:{userId_stickerId:{userId,stickerId:sticker.id}},create:{userId,stickerId:sticker.id,quantity:1},update:{quantity:{increment:1}}});
    await tx.stickerGrant.create({data:{userId,stickerId:sticker.id,quantity:1,reason:'Автоматическая награда: '+rule.event}});
    return true;
   });
   if(didGrant)earned.push(sticker);
  }catch(e){if(e.code==='P2002')continue;throw e}
 }
 return earned;
}
