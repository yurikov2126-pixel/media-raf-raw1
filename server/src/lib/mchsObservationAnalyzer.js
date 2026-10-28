import { prisma } from './prisma.js';
import { assessMchsQueueObservation } from './mchsQueueAssessment.js';
import { noteMchsAnalyzerAttempt, noteMchsAnalyzerSuccess, noteMchsAnalyzerFailure, persistMchsAnalyzerHealth } from './mchsAnalyzerHealth.js';

// Observation-only background worker. No official alert verification and no audio output.
export async function analyzeMchsObservationBatch(db=prisma,{limit=20}={}) {
  return db.$transaction(async tx=>{
    // Shared with POST /safety/observation-queue/analyze. Concurrent instances serialize.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581423)`;
    const items=await tx.safetyMchsQueueItem.findMany({
      where:{status:'OBSERVED'},orderBy:[{createdAt:'asc'},{id:'asc'}],
      take:Math.max(1,Math.min(50,limit)),
      select:{id:true,event:{select:{title:true,body:true,occurredAt:true}}}
    });
    const reasons={};
    for(const item of items) {
      const outcome=assessMchsQueueObservation(item.event);
      await tx.safetyMchsQueueItem.update({
        where:{id:item.id,status:'OBSERVED'},data:{status:'ANALYZED'}
      });
      await tx.safetyMchsQueueHistory.upsert({
        where:{queueId_status_reason:{queueId:item.id,status:'ANALYZED',reason:outcome.reason}},
        create:{queueId:item.id,status:'ANALYZED',reason:outcome.reason},update:{}
      });
      reasons[outcome.reason]=(reasons[outcome.reason]||0)+1;
    }
    return {processed:items.length,reasons,playbackEnabled:false};
  },{timeout:15000});
}

export function startMchsObservationAnalyzer({
  enabled=process.env.MCHS_OBSERVATION_ANALYZER_ENABLED==='true',
  intervalMs=15000,logger=console,
}={}) {
  if(!enabled) return {enabled:false,stop(){}};
  let stopped=false,running=false;
  const tick=async()=>{
    if(stopped||running)return;
    running=true;
    noteMchsAnalyzerAttempt();
    try {
      const result=await analyzeMchsObservationBatch();
      noteMchsAnalyzerSuccess(result.processed);
      if(result.processed)logger.info('MCHS_OBSERVATION_ANALYZED',JSON.stringify(result));
    }catch(error){
      noteMchsAnalyzerFailure(error);
      logger.error('MCHS_OBSERVATION_ANALYZER_ERROR',error);
    }finally{
      try { await persistMchsAnalyzerHealth(); }
      catch(error){ noteMchsAnalyzerFailure(error); logger.error('MCHS_OBSERVATION_HEALTH_PERSIST_ERROR',error); }
      running=false;
    }
  };
  const timer=setInterval(()=>{void tick();},intervalMs);
  timer.unref?.();
  void tick();
  return {enabled:true,stop(){stopped=true;clearInterval(timer);}};
}
