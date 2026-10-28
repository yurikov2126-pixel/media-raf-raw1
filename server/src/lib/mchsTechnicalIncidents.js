import { prisma } from './prisma.js';
import { getIo } from './notify.js';
import { assessMchsRetryBacklog } from './mchsRetryBacklog.js';

// Operational observations only; never authorizes emergency alerts or audio.
export function mchsIncidentSignals(health, nowMs=Date.now(), history=null) {
  if (!health?.lastSeenAt) return null; // no baseline, not an outage
  const fresh = nowMs-new Date(health.lastSeenAt).getTime() <= 180000;
  const signals = {
    HEARTBEAT: !fresh ? 'HEARTBEAT_STALE' : null,
    SNAPSHOT: !fresh || health.snapshotOk == null ? undefined : (health.snapshotOk === false ? 'ANDROID_SQLITE_READ_FAILED' : null),
    RETRY: undefined,
    BACKLOG: undefined,
    TELEMETRY: undefined,
  };
  if (fresh) {
    signals.TELEMETRY = !health.telemetryAt || nowMs-new Date(health.telemetryAt).getTime()>600000 ? 'TELEMETRY_STALE_OVER_10_MINUTES' : null;
  }
  if (fresh && health.telemetryAt && nowMs-new Date(health.telemetryAt).getTime() <= 180000) {
    signals.RETRY=null;
    signals.BACKLOG=null;
    const retry = assessMchsRetryBacklog(health,{nowMs});
    if (retry.state === 'WARNING') signals.RETRY = retry.reason;
    const oldest=health.oldestPendingAt ? new Date(health.oldestPendingAt).getTime() : NaN;
    if (health.queuedLocal > 0 && Number.isFinite(oldest) && nowMs-oldest > 600000)
      signals.BACKLOG='OLDEST_PENDING_OVER_10_MINUTES';
  }
  if (Array.isArray(history) && fresh) {
    const recent=history.filter(sample=>sample.telemetryPresent &&
      nowMs-new Date(sample.receivedAt).getTime()<=900000 &&
      nowMs-new Date(sample.receivedAt).getTime()>=0);
    // Require three independent samples spanning at least two minutes.
    const spansWindow=recent.length>=3 &&
      new Date(recent[0].receivedAt).getTime()-new Date(recent[recent.length-1].receivedAt).getTime()>=120000;
    if(spansWindow){
      const lastThree=recent.slice(0,3);
      if(lastThree.every(x=>x.queuedLocal!==null&&x.queuedLocal>=5))
        signals.BACKLOG='SUSTAINED_LOCAL_QUEUE_5_OR_MORE';
      else if(lastThree.every(x=>x.queuedLocal===0)) signals.BACKLOG=null;
      if(lastThree.every(x=>x.retryPending!==null&&x.retryPending>0))
        signals.RETRY='SUSTAINED_RETRY_PENDING';
      else if(lastThree.every(x=>x.retryPending===0)) signals.RETRY=null;
      if(lastThree.every(x=>x.snapshotOk===false))
        signals.SNAPSHOT='SUSTAINED_SQLITE_READ_FAILURE';
      else if(lastThree.every(x=>x.snapshotOk===true)) signals.SNAPSHOT=null;
    }
  }
  return signals;
}

const incidentTitles = {
  HEARTBEAT:'Нет heartbeat Android VM',
  SNAPSHOT:'Ошибка чтения Android SQLite',
  RETRY:'Просрочена повторная отправка',
  BACKLOG:'Событие долго ожидает подтверждения',
  TELEMETRY:'Телеметрия Android VM устарела',
};
export function technicalIncidentNotification(incident, phase) {
  const restored=phase==='resolved';
  const title=restored?'МЧС · техническая связь восстановлена':'МЧС · техническая неисправность';
  const subject=incidentTitles[incident.kind] || 'Неисправность диагностики';
  const time=restored?incident.resolvedAt:incident.openedAt;
  const message=`${subject}. ${restored?'Восстановление':'Обнаружение'}: ${time.toISOString()}.`;
  return {title,message,url:`/app/admin?tab=safety-mchs&incident=${encodeURIComponent(incident.id)}`,incidentId:incident.id,phase,
    diagnosticOnly:true,officialAlert:false};
}

export async function recordMchsTechnicalIncidents(db=prisma, now=new Date(), {io=getIo()}={}) {
  const result=await db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581427)`;
    const health=await tx.safetyMchsHealth.findUnique({where:{id:'mchs-android'}});
    const history=await tx.safetyMchsTelemetrySample.findMany({
      where:{receivedAt:{gte:new Date(now.getTime()-900000)}},
      orderBy:{receivedAt:'desc'},take:30,
      select:{receivedAt:true,telemetryPresent:true,queuedLocal:true,retryPending:true,snapshotOk:true}
    });
    const signals=mchsIncidentSignals(health,now.getTime(),history);
    if(!signals) return {observed:false,playbackEnabled:false};
    const open=await tx.safetyMchsTechnicalIncident.findMany({where:{resolvedAt:null}});
    const admins=await tx.user.findMany({where:{role:'ADMIN',isBanned:false},select:{id:true}});
    const emitted=[];
    const notify=async (incident,phase)=>{
      const payload=technicalIncidentNotification(incident,phase);
      for(const admin of admins) {
        const n=await tx.notification.create({data:{userId:admin.id,type:'system',payload:JSON.stringify(payload)}});
        emitted.push({userId:admin.id,notification:{...n,payload}});
      }
    };
    for(const [kind,reason] of Object.entries(signals)) {
      const active=open.find(x=>x.kind===kind);
      if (reason === undefined) continue;
      if (reason && !active) {
        const opened=await tx.safetyMchsTechnicalIncident.create({data:{kind,reason,openedAt:now}});
        await notify(opened,'opened');
      }
      if (!reason && active) {
        const resolved=await tx.safetyMchsTechnicalIncident.update({where:{id:active.id},data:{resolvedAt:now}});
        await notify(resolved,'resolved');
      }
    }
    return {observed:true,playbackEnabled:false,emitted};
  });
  // Emit only after COMMIT: clients never see notifications rolled back by the DB.
  for(const item of result.emitted || []) io?.to(`user:${item.userId}`).emit('notification:new',item.notification);
  return {observed:result.observed,playbackEnabled:false};
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
