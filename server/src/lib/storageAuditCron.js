import { prisma } from './prisma.js';
import { snapshot } from '../routes/admin/storageCenter.js';

const DAY = 24 * 60 * 60 * 1000;
let running = false;
async function audit() {
 if (running) return;
 running = true;
 try {
   const previous = await prisma.setting.findUnique({where:{key:'storage_audit_last'}});
   if(previous?.value){
     const last=JSON.parse(previous.value);
     if(Date.now()-new Date(last.checkedAt).getTime()<DAY)return;
   }
   const report=await snapshot({deep:true});
   const summary={checkedAt:report.checkedAt,stats:report.stats};
   await prisma.setting.upsert({where:{key:'storage_audit_last'},create:{key:'storage_audit_last',value:JSON.stringify(summary)},update:{value:JSON.stringify(summary)}});
   if(report.stats.untracked || report.stats.broken || report.stats.orphanPreviews)
     console.warn('[storage-audit] integrity issues',summary);
 }catch(error){console.error('[storage-audit] failed',error);}
 finally{running=false;}
}
export function scheduleStorageAudit(){
 const t=setInterval(audit,60*60*1000);t.unref?.();
 // Delay startup to avoid simultaneous database migrations / worker initialization.
 const first=setTimeout(audit,5*60*1000);first.unref?.();
}
