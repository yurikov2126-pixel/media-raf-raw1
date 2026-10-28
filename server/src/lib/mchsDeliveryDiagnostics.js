/** Read-only delivery observations; no proof that Android received every push. */
export function summarizeMchsDelivery({health=null,lastEvent=null,pending=0,analyzer=null,nowMs=Date.now()}={}) {
 const seen=health?.lastSeenAt?new Date(health.lastSeenAt).getTime():NaN;
 const heartbeatAgeMs=Number.isFinite(seen)?Math.max(0,nowMs-seen):null;
 const connection=heartbeatAgeMs===null?'NO_HEARTBEAT':heartbeatAgeMs>180000?'HEARTBEAT_STALE':'HEARTBEAT_RECENT';
 const received=lastEvent?.receivedAt?new Date(lastEvent.receivedAt).getTime():NaN;
 const occurred=lastEvent?.occurredAt?new Date(lastEvent.occurredAt).getTime():NaN;
 const deliveryLagMs=Number.isFinite(received)&&Number.isFinite(occurred)?Math.max(0,received-occurred):null;
 return {
  connection,heartbeatAgeMs,
  lastHeartbeatAt:health?.lastSeenAt||null,
  listener:connection==='HEARTBEAT_RECENT'?health?.listener||'UNKNOWN':'UNVERIFIED',
  push:connection==='HEARTBEAT_RECENT'?health?.push||'UNKNOWN':'UNVERIFIED',
  lastReceivedAt:lastEvent?.receivedAt||null,lastOccurredAt:lastEvent?.occurredAt||null,
  lastEventLagMs:deliveryLagMs,pending,
  analyzerHealthy:analyzer?.healthy===true,
  deliveryCompleteness:'UNKNOWN',missingEventsKnown:false,
  noRecentEventsIsFailure:false,officialVerified:false,playbackEnabled:false,
 };
}
