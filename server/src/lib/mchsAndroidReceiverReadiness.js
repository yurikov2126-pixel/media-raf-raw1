/** Read-only assessment of Android notification receiver after VM power restoration.
 * Transport heartbeat, SQLite access and NotificationListener are distinct.
 * No heartbeat, SQLite snapshot or historical row is evidence of FCM push delivery.
 */
export function assessAndroidReceiverReadiness({samples=[],lastSeenAt=null,nowMs=Date.now()}={}){
  const age=lastSeenAt?nowMs-new Date(lastSeenAt).getTime():Infinity;
  if(!Number.isFinite(age)||age<0||age>5*60000)
    return {state:'HEARTBEAT_STALE',code:null,detail:'Нет свежего heartbeat Android VM'};
  const recent=(Array.isArray(samples)?samples:[]).filter(row=>{
    const ms=new Date(row?.receivedAt).getTime();
    return Number.isFinite(ms)&&ms<=nowMs&&nowMs-ms<=5*60000;
  }).slice(0,5);
  if(recent.length<3)return {state:'INSUFFICIENT_SAMPLES',code:null,
    detail:'Недостаточно последних измерений NotificationListener'};
  // 3 consecutive recent observations (newest-first) reject transient restarts.
  const latest=recent.slice(0,3);
  if(latest.every(s=>s.listener==='DISCONNECTED'))
    return {state:'LISTENER_DISCONNECTED',code:'ANDROID_LISTENER_DISCONNECTED',
      detail:'Heartbeat работает, но Android NotificationListener отключён в трёх последовательных измерениях'};
  if(latest.every(s=>s.snapshotOk===false))
    return {state:'SNAPSHOT_UNAVAILABLE',code:'ANDROID_SNAPSHOT_UNAVAILABLE',
      detail:'Heartbeat работает, но SQLite Android недоступна в трёх последовательных измерениях'};
  if(latest.every(s=>s.listener==='CONNECTED'&&s.snapshotOk===true))
    return {state:'RECEIVER_OBSERVED',code:null,
      detail:'Android listener и SQLite доступны; получение будущих push-уведомлений не подтверждено'};
  return {state:'RECOVERING_OR_UNKNOWN',code:null,
    detail:'Наблюдения о NotificationListener и SQLite неоднозначны'};
}
