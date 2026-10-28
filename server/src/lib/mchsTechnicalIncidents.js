import { prisma } from './prisma.js';
import { assessMchsRetryBacklog } from './mchsRetryBacklog.js';

// Operational observations only; never authorizes emergency alerts or audio.
export function mchsIncidentSignals(health, nowMs=Date.now()) {
  if (!health?.lastSeenAt) return null; // no baseline, not an outage
  const fresh = nowMs-new Date(health.lastSeenAt).getTime() <= 180000;
  const signals = {
    HEARTBEAT: !fresh ? 'HEARTBEAT_STALE' : null,
    SNAPSHOT: !fresh || health.snapshotOk == null ? undefined : (health.snapshotOk === false ? 'ANDROID_SQLITE_READ_FAILED' : null),
    RETRY: undefined,
    BACKLOG: undefined,
  };
  if (fresh && health.telemetryAt && nowMs-new Date(health.telemetryAt).getTime() <= 180000) {
    signals.RETRY=null;
    signals.BACKLOG=null;
    const retry = assessMchsRetryBacklog(health,{nowMs});
    if (retry.state === 'WARNING') signals.RETRY = retry.reason;
    const oldest=health.oldestPendingAt ? new Date(health.oldestPendingAt).getTime() : NaN;
    if (health.queuedLocal > 0 && Number.isFinite(oldest) && nowMs-oldest > 600000)
      signals.BACKLOG='OLDEST_PENDING_OVER_10_MINUTES';
  }
  return signals;
}

export async function recordMchsTechnicalIncidents(db=prisma, now=new Date()) {
  return db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581427)`;
    const health=await tx.safetyMchsHealth.findUnique({where:{id:'mchs-android'}});
    const signals=mchsIncidentSignals(health,now.getTime());
    if(!signals) return {observed:false,playbackEnabled:false};
    const open=await tx.safetyMchsTechnicalIncident.findMany({where:{resolvedAt:null}});
    for(const [kind,reason] of Object.entries(signals)) {
      const active=open.find(x=>x.kind===kind);
      if (reason === undefined) continue;
      if (reason && !active) await tx.safetyMchsTechnicalIncident.create({data:{kind,reason,openedAt:now}});
      if (!reason && active) await tx.safetyMchsTechnicalIncident.update({where:{id:active.id},data:{resolvedAt:now}});
    }
    return {observed:true,playbackEnabled:false};
  });
}
export function startMchsTechnicalIncidentMonitor({intervalMs=60000,logger=console}={}) {
  let busy=false;
  const tick=async()=>{
    if(busy)return;busy=true;
    try{await recordMchsTechnicalIncidents();}
    catch(err){logger.error('MCHS_TECHNICAL_MONITOR_ERROR',err);}
    finally{busy=false;}
  };
  const timer=setInterval(()=>{void tick();},intervalMs);
  timer.unref?.();
  void tick();
  return {stop(){clearInterval(timer);}};
}
