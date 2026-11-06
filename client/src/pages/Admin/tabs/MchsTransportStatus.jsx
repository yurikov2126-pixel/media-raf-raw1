import {useCallback,useEffect,useState} from 'react';
import {api} from '../../../api/client.js';

const reasonNames={
 SIGNED_PERMIT_FALSE:'Отмена разрешения со стороны Windows Agent',
 POWER_INTERLOCK_REJECTED:'Контроллер отказал во включении из-за блокировки',
 WIFI_RECONNECT:'Повторное подключение Wi-Fi',
 WIFI_LOST:'Пропала связь ESP32 с Wi-Fi',
 HEARTBEAT_TIMEOUT:'Истёк срок heartbeat от Windows Agent',
 POWER_LEASE_EXPIRED:'Истёк срок разрешения на питание (lease)',
 SIGNED_MAINTENANCE_RESTART:'Авторизованный перезапуск ESP32',
 SIGNED_FIRMWARE_UPDATE:'Обновление прошивки',
 FIRMWARE_UPDATE_COMPLETED:'Завершение обновления прошивки',
 SCHEDULED_REBOOT:'Перезапуск контроллера',
 BOOT_SAFE_OFF:'Безопасное состояние после загрузки',
 UNSPECIFIED_OFF:'Выключение без уточнённой причины'
};
const kinds={
 FIRMWARE_RELAY_OFF:'ESP32: счётчик выключений вырос',
 FIRMWARE_RELAY_ON:'ESP32: GPIO13 включён',
 FIRMWARE_REBOOT:'ESP32 перезагрузилась',
 FIRMWARE_COUNTER_RESET:'Счётчик ESP32 сброшен',
 AGENT_POWER_INTENT_RESPONSE:'Windows Agent: ответ сервера',
 AGENT_POWER_INTENT_ERROR:'Windows Agent: ошибка получения разрешения',
 AGENT_POWER_POWER_COMMAND:'Windows Agent: команда питания подтверждена',
 AGENT_POWER_POWER_ERROR:'Windows Agent: ошибка команды питания',
 AGENT_POWER_RELAY_TRANSITION:'Windows Agent: подтверждён переход',
 FIRMWARE_GPIO_OFF:'ESP32: GPIO13 выключен (событие прошивки)',
 FIRMWARE_GPIO_ON:'ESP32: GPIO13 включён (событие прошивки)',
 FIRMWARE_HISTORY_OVERFLOW:'ESP32: промежуточные события потеряны',
 COMMANDED_POWER_CHANGED:'Изменилось командное состояние усилителя',
 LEASE_CHANGED:'Изменилось разрешение реле',
 HEARTBEAT_CHANGED:'Изменился heartbeat',
 HEARTBEAT_COUNTER_RESET:'Сбросился счётчик heartbeat',
 TELEMETRY_GAP:'Пропуск телеметрии',
 REPORTER_CHANGED:'Сменился Windows Agent',
 AGENT_MODE_CHANGED:'Изменился режим Agent'
};
const eventLabels={MISSILE_DANGER:'Ракетная опасность',MISSILE_ALL_CLEAR:'Отбой ракетной опасности'};
const boolText=v=>v===true?'Да':v===false?'Нет':'Нет данных';
const stateText=v=>v||'Нет данных';

export default function MchsTransportStatus({token}){
 const [station,setStation]=useState(null);
 const [preflight,setPreflight]=useState(null);
 const [intents,setIntents]=useState(null);
 const [receipts,setReceipts]=useState(null);
 const [error,setError]=useState('');
 const [updated,setUpdated]=useState(null);
 const [loading,setLoading]=useState(false);
 const load=useCallback(async()=>{
  const [s,p,i,r]=await Promise.all([
   api('/safety/missile-main-station-readiness',{token}),
   api('/safety/missile-live-trial-preflight',{token}),
   api('/safety/missile-android-execution-intents',{token}),
   api('/safety/missile-station-execution-receipts',{token})
  ]);
  return {s,p,i,r};
 },[token]);
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{
   const {s,p,i,r}=await load();
   setStation(s);setPreflight(p);setIntents(i);setReceipts(r);
   setError('');setUpdated(new Date());
  }catch(e){setError(e.message||'Ошибка получения состояния');}
  finally{setLoading(false);}
 },[load]);
 useEffect(()=>{
  let alive=true;
  const tick=async()=>{
   try{
    const {s,p,i,r}=await load();
    if(alive){setStation(s);setPreflight(p);setIntents(i);setReceipts(r);
     setError('');setUpdated(new Date());}
   }catch(e){if(alive)setError(e.message||'Сервер диагностики недоступен');}
  };
  void tick();
  const timer=setInterval(()=>{void tick();},15000);
  return ()=>{alive=false;clearInterval(timer);};
 },[load]);
 const worker=station?.worker,agent=station?.agent,esp=station?.esp32;
 const events=station?.esp32Transitions?.events||[];
 const items=intents?.ledger?.items||[];
 const records=receipts?.ledger?.items||[];
 const counts={
  waiting:items.filter(x=>['STAGED','QUEUED'].includes(x.status)).length,
  processing:items.filter(x=>['DISPATCHING','START_ACCEPTED'].includes(x.status)).length,
  uncertain:items.filter(x=>x.status==='UNKNOWN').length
 };
 const cards=[
  {name:'Radio Worker',value:worker?.reachable?'На связи':'Нет связи',detail:'Фаза: '+stateText(worker?.phase)+' · PCM-журнал: '+boolText(worker?.journalHealthy)},
  {name:'Windows Agent',value:agent?.online?'В сети':'Нет связи',detail:'Устройство привязано: '+boolText(agent?.deviceBound)+' · Воспроизведение разрешено: '+boolText(agent?.playbackAllowed)},
  {name:'ESP32',value:esp?.fresh?'Телеметрия актуальна':'Нет свежих данных',detail:'Heartbeat: '+boolText(esp?.heartbeatFresh)+' · Lease: '+boolText(esp?.leaseValid)},
  {name:'GPIO13 / AA-300',value:stateText(esp?.amplifierPower),detail:'Только командное состояние, не измеренное питание'}
 ];
 return <section className="mchs-panel rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-4 sm:p-5 space-y-4" aria-label="Диагностика основного тракта МЧС">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div>
    <h3 className="text-lg font-semibold">Основной тракт экстренного оповещения</h3>
    <p className="text-sm text-slate-600 dark:text-slate-300">Данные Radio Worker, Windows Agent и ESP32 без запуска оповещений и без команд управления усилителем.</p>
   </div>
   <button type="button" onClick={refresh} disabled={loading} className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-sm disabled:opacity-50">{loading?'Проверяем…':'Обновить'}</button>
  </div>
  {error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">Не удалось обновить диагностику: {error}</p>}
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   {cards.map(card=><div key={card.name} className="rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 p-3 min-w-0">
    <div className="text-xs text-slate-600 dark:text-slate-300">{card.name}</div>
    <strong className="block mt-1 text-sm break-words">{station?card.value:'Ожидание данных'}</strong>
    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{card.detail}</p>
   </div>)}
  </div>
  <div className="rounded-xl border border-amber-300/60 dark:border-amber-400/30 p-3 space-y-2">
   <strong className="block text-sm">Готовность физического оповещения: не подтверждена</strong>
   <p className="text-xs text-slate-600 dark:text-slate-300">PCM на сервере, heartbeat Agent и команда ON не доказывают наличие звука в коридорах. Отчёт не разрешает включение реле.</p>
   <div className="grid sm:grid-cols-3 gap-2 text-xs">
    <span>Android → Worker: {boolText(station?.flags?.androidDispatch&&station?.flags?.coordinator&&station?.flags?.workerCommands)}</span>
    <span>PCM подтверждений: {station?.stationReceipt?.confirmedCount??'—'}</span>
    <span>Неподтверждённых требований: {station?.holds?.length??'—'}</span>
   </div>
   {!!station?.holds?.length&&<details className="text-xs">
    <summary className="cursor-pointer">Причины ограничений ({station.holds.length})</summary>
    <ul className="mt-2 list-disc pl-5 space-y-1">{station.holds.map((x,i)=><li key={x+i}>{x}</li>)}</ul>
   </details>}
  </div>
  <section className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-3" aria-label="Причины выключения GPIO13">
   <div>
    <strong className="text-sm">История управления усилителем</strong>
    <p className="text-xs text-slate-600 dark:text-slate-300">Счётчики ESP32 выявляют даже короткое OFF→ON между опросами. Все времена событий — время наблюдения сервером, не измерение на силовой линии.</p>
   </div>
   <div className="grid gap-2 sm:grid-cols-3 text-sm">
    <div className="rounded-lg bg-slate-50 dark:bg-white/5 p-3">Включений GPIO13: <strong>{esp?.relayOnTransitions??'—'}</strong></div>
    <div className="rounded-lg bg-slate-50 dark:bg-white/5 p-3">Выключений GPIO13: <strong>{esp?.relayOffTransitions??'—'}</strong></div>
    <div className="rounded-lg bg-slate-50 dark:bg-white/5 p-3">Последняя причина OFF: <strong className="break-words">{reasonNames[esp?.lastRelayOffReason]||esp?.lastRelayOffReason||'Нет данных'}</strong></div>
   </div>
   <div className="grid gap-2 sm:grid-cols-2 text-xs">
    <div className="rounded-lg border border-slate-200 dark:border-white/15 p-2">История GPIO13 из прошивки: <strong>{esp?.firmwareHistoryReported?'Получена':'Не подтверждена'}</strong></div>
    <div className="rounded-lg border border-slate-200 dark:border-white/15 p-2">Диагностика команд Windows Agent: <strong>{esp?.agentPowerEvidenceReported?'Получена':'Не подтверждена'}</strong></div>
   </div>
   {!esp?.firmwareHistoryReported&&<p className="text-xs text-amber-700 dark:text-amber-300">Журнал переключений с новой прошивки пока не получен. Проверьте версию прошивки и подключение Windows Agent; сами счётчики старой прошивки не подтверждают доставку журнала.</p>}
   {!esp?.agentPowerEvidenceReported&&<p className="text-xs text-amber-700 dark:text-amber-300">Нет подтверждения передачи решений питания из Windows Agent. Необходимо обновить исполняемый файл Agent и проверить его авторизованную связь с сервером.</p>}
   <p className="text-xs text-slate-600 dark:text-slate-300">Наличие диагностического канала не доказывает, что реле физически включено. Отсутствие событий может означать отсутствие переключений, а не неисправность.</p>
   {events.length?<div className="max-h-72 overflow-auto space-y-2" aria-label="Журнал переходов ESP32">
    {[...events].reverse().map((event,i)=><div key={event.at+event.kind+i} className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2 text-xs">
     <strong>{kinds[event.kind]||event.kind}</strong>
     <span className="ml-2 text-slate-600 dark:text-slate-300">{new Date(event.at).toLocaleString('ru-RU')}</span>
     <span className="block mt-1 break-words">{event.kind==='FIRMWARE_RELAY_OFF'?
      reasonNames[String(event.detail||'').split(':').slice(1).join(':')]||event.detail:
      event.kind==='FIRMWARE_GPIO_OFF'||event.kind==='FIRMWARE_GPIO_ON'?
       (reasonNames[event.detail]||event.detail)+' · #'+event.seq+' · '+event.uptimeMs+' мс от запуска':
       event.detail}</span>
     {event.kind?.startsWith('AGENT_POWER_')&&<span className="block mt-1 text-slate-600 dark:text-slate-300">Разрешение: {event.permit===true?'Да':event.permit===false?'Нет':'Неизвестно'}{event.httpStatus?' · HTTP '+event.httpStatus:''} · Windows Agent</span>}
    </div>)}
   </div>:<p className="text-xs text-slate-600 dark:text-slate-300">За последние 10 минут изменений не зарегистрировано. Это не является доказательством отсутствия физических отключений.</p>}
  </section>
  <section className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-3" aria-label="Очередь автоматических событий">
   <strong className="text-sm">Очередь ALARM и отбоя</strong>
   <p className="text-xs text-slate-600 dark:text-slate-300">Ожидают: {counts.waiting} · В обработке: {counts.processing} · Неопределённый результат: {counts.uncertain}</p>
   <div className="space-y-2 max-h-52 overflow-auto">
    {[...items].slice(-6).reverse().map(x=><div key={x.eventId||x.sourceEventId} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 dark:bg-white/5 p-2 text-xs">
     <span>{eventLabels[x.eventType]||x.eventType||'Событие'}</span>
     <strong>{x.status||'—'}</strong>
    </div>)}
    {!items.length&&<p className="text-xs text-slate-600 dark:text-slate-300">Событий в очереди нет.</p>}
   </div>
   <strong className="block text-sm">Последние результаты PCM</strong>
   <div className="space-y-1 text-xs">
    {[...records].slice(-4).reverse().map(x=><div key={x.eventId} className="flex justify-between gap-2">
     <span>{eventLabels[x.eventType]||x.eventType||'Событие'}</span>
     <strong>{x.state}</strong>
    </div>)}
    {!records.length&&<p>Подтверждённых событий пока нет.</p>}
   </div>
  </section>
  <section className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-2">
   <strong className="text-sm">Настройки двух уведомлений Тульской области</strong>
   <div className="grid sm:grid-cols-2 gap-2">
    {(preflight?.types||[]).map(x=><div key={x.type} className="rounded-lg bg-slate-50 dark:bg-white/5 p-3 text-xs">
     <strong>{eventLabels[x.type]||x.type}</strong>
     <p className="mt-1 break-all">ALARM: {x.audioAssetId||'Не выбран'} · Повторы: {x.repeats??'—'}</p>
     <p>{x.configured?'Файл назначен':'Требуется настройка'}</p>
    </div>)}
   </div>
  </section>
  <p className="text-xs text-slate-600 dark:text-slate-300">Последнее обновление: {updated?updated.toLocaleString('ru-RU'):'Нет данных'} · Автоматическая проверка каждые 15 секунд.</p>
 </section>;
}
