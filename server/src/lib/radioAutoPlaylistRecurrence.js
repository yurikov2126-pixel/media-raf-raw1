import {prisma} from './prisma.js';
import {previewAutoPlaylist} from './radioAutoPlaylistService.js';
import {prepareAutoPlaylistPublication} from './radioAutoPlaylistPublication.js';
import {writeRadioPlaylistItems} from './radioPlaylistBulk.js';
const DAY=86400000,OFFSET=3*3600000;
export function validateRadioAutoPlaylistRule(body){
 const days=body?.weekdays,minute=body?.startMinute;
 if(!Array.isArray(days)||days.length<1||days.length>7||
   days.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(days).size!==days.length||
   !Number.isInteger(minute)||minute<0||minute>=1440)
  throw new RangeError('Выберите дни недели и время по Москве');
 if(body.enabled!==undefined&&typeof body.enabled!=='boolean')
  throw new RangeError('Некорректное состояние расписания');
 return {weekdays:days,startMinute:minute,enabled:body.enabled===true};
}
export function upcomingMoscowDates(now,days=7){
 const dates=[];
 const localToday=Math.floor((now.getTime()+OFFSET)/DAY)*DAY;
 for(let d=0;d<days;d++){
  const local=localToday+d*DAY;
  const day=new Date(local).getUTCDay();
  dates.push({localDate:new Date(local).toISOString().slice(0,10),day,local});
 }
 return dates;
}
export async function materializeRadioAutoPlaylistRules({db=prisma,now=new Date(),days=7}={}){
 const rules=await db.radioAutoPlaylistRule.findMany({
  where:{enabled:true},include:{autoPlaylist:true}});
 const dates=upcomingMoscowDates(now,days);
 const summary={created:0,skipped:0,conflicts:0,errors:[]};
 for(const rule of rules){
  for(const date of dates){
   if(!rule.weekdays.includes(date.day))continue;
   const startMs=date.local+rule.startMinute*60000-OFFSET;
   if(startMs<=now.getTime()+10*60000){summary.skipped++;continue;}
   try{
    // Preview from the current library, not a stale draft. Each day gets a
    // deterministic but distinct sequence. Only complete, valid lineups air.
    const config=rule.autoPlaylist;
    const preview=await previewAutoPlaylist(config,{db,seed:rule.id+':'+date.localDate});
    if(!preview.items.length){summary.errors.push({ruleId:rule.id,date:date.localDate,error:'EMPTY_PLAYLIST'});continue;}
    const ids=[...new Set(preview.items.map(x=>x.assetId))];
    const assets=await db.radioAsset.findMany({where:{id:{in:ids}},select:{id:true,durationMs:true}});
    const prepared=prepareAutoPlaylistPublication(preview.items.map(item=>({...item,pinned:false,fadeMs:Math.round(item.fadeMs||0)})),assets);
    const result=await db.$transaction(async tx=>{
     await tx.$executeRaw`SELECT pg_advisory_xact_lock(1729002)`;
     const exists=await tx.radioAutoPlaylistRuleSlot.findUnique({
      where:{ruleId_localDate:{ruleId:rule.id,localDate:date.localDate}}});
     if(exists)return 'exists';
     const startAt=new Date(startMs),endAt=new Date(startMs+prepared.durationMs);
     const conflict=await tx.radioScheduleSlot.findFirst({
      where:{startAt:{lt:endAt},endAt:{gt:startAt}},select:{id:true}});
     if(conflict)return 'conflict';
     const playlist=await tx.radioPlaylist.create({data:{
      name:config.name+' · '+date.localDate,description:'Автоплейлист · регулярная эфирная версия',
      createdBy:rule.createdBy,status:'APPROVED',approvedBy:rule.createdBy,approvedAt:new Date(),
     }});
     await writeRadioPlaylistItems(tx,playlist.id,prepared.assetIds,prepared.transitions);
     const slot=await tx.radioScheduleSlot.create({data:{
      playlistId:playlist.id,title:config.name,startAt,endAt,createdBy:rule.createdBy,
     }});
     await tx.radioAutoPlaylistRuleSlot.create({data:{
      ruleId:rule.id,localDate:date.localDate,slotId:slot.id,
     }});
     return 'created';
    },{maxWait:10000,timeout:60000});
    if(result==='created')summary.created++;
    else if(result==='conflict')summary.conflicts++;
    else summary.skipped++;
   }catch(e){summary.errors.push({ruleId:rule.id,date:date.localDate,error:String(e.message||e)});}
  }
 }
 return summary;
}
