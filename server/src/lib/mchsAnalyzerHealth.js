import { prisma } from './prisma.js';

export const MCHS_ANALYZER_HEALTH_KEY='mchs_observation_analyzer_health_v1';
const health={running:false,lastAttemptAt:null,lastSuccessAt:null,lastErrorAt:null,lastError:null,processedTotal:0,lastProcessed:0};
export function getMchsAnalyzerRuntimeHealth(){return {...health};}
export function resetMchsAnalyzerHealthForTests(){Object.assign(health,{running:false,lastAttemptAt:null,lastSuccessAt:null,lastErrorAt:null,lastError:null,processedTotal:0,lastProcessed:0});}
export function noteMchsAnalyzerAttempt(now=new Date()){health.running=true;health.lastAttemptAt=now.toISOString();}
export function noteMchsAnalyzerSuccess(processed,now=new Date()){
 health.running=false;health.lastSuccessAt=now.toISOString();health.lastError=null;
 health.lastProcessed=processed;health.processedTotal+=processed;
}
export function noteMchsAnalyzerFailure(error,now=new Date()){
 health.running=false;health.lastErrorAt=now.toISOString();
 health.lastError=String(error?.message||error||'UNKNOWN').slice(0,350);
}
export function mchsAnalyzerPublicStatus(configured,nowMs=Date.now()){
 const runtime=getMchsAnalyzerRuntimeHealth();
 const last=Date.parse(runtime.lastSuccessAt||'');
 const ageMs=Number.isFinite(last)?Math.max(0,nowMs-last):null;
 const healthy=Boolean(configured&&ageMs!==null&&ageMs<=90000&&!runtime.lastError);
 return {configured,executionConfirmed:healthy,healthy,ageMs,runtime,
  playbackEnabled:false,officialState:'UNKNOWN'};
}
export async function persistMchsAnalyzerHealth(db=prisma){
 const value=JSON.stringify({version:1,...getMchsAnalyzerRuntimeHealth(),savedAt:new Date().toISOString()});
 await db.setting.upsert({
  where:{key:MCHS_ANALYZER_HEALTH_KEY},
  create:{key:MCHS_ANALYZER_HEALTH_KEY,value},update:{value}
 });
}
