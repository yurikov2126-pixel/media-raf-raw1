import { prisma } from './prisma.js';
const KEY='radio_playout_history_v1';
const LIMIT=250;
export function normalizeHistory(data){
 const items=Array.isArray(data)?data:[];
 return items.filter(e=>e&&typeof e.id==='string'&&typeof e.startedAt==='string'&&
  Number.isFinite(Date.parse(e.startedAt))&&['AUTO_DJ','SCHEDULED'].includes(e.mode))
  .slice(-LIMIT);
}
export async function readPlayoutHistory(db=prisma){
 const row=await db.setting.findUnique({where:{key:KEY}});
 try{return normalizeHistory(JSON.parse(row?.value||'[]'));}catch{return [];}
}
/** Persist mixed-deck events as one journal update, protected against concurrent writers. */
export async function recordPlayoutEvents(events,db=prisma){
 const incoming=normalizeHistory(events);
 if(!incoming.length)return readPlayoutHistory(db);
 const append=async tx=>{
  const current=await readPlayoutHistory(tx);
  const next=normalizeHistory([...current,...incoming]);
  await tx.setting.upsert({where:{key:KEY},create:{key:KEY,value:JSON.stringify(next)},
   update:{value:JSON.stringify(next)}});
  return next;
 };
 if(typeof db.$transaction==='function'){
  return db.$transaction(async tx=>{
   // Transaction-level advisory lock serializes journal writers across Worker instances.
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(1729042)`;
   return append(tx);
  });
 }
 return append(db);
}
export async function recordPlayoutEvent(event,db=prisma){
 return recordPlayoutEvents([event],db);
}
export function recentlyPlayed(history,id,minutes,nowMs=Date.now()){
 if(!minutes)return false;
 const cutoff=nowMs-minutes*60000;
 return history.some(e=>e.id===id&&Date.parse(e.startedAt)>cutoff&&Date.parse(e.startedAt)<=nowMs);
}
