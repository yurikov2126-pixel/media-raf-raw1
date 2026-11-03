import {useCallback,useEffect,useState} from 'react';
import {api} from '../../../api/client.js';

const when=value=>value?new Date(value).toLocaleString('ru-RU'):'Нет данных';
const eventLabel={MISSILE_DANGER:'Опасность',MISSILE_ALL_CLEAR:'Отбой'};
const stateLabel={COMPLETE:'Учебное воспроизведение завершено',FAILED:'Ошибка учебного воспроизведения'};
const failureLabel={
 VLC_START_REJECTED:'Не удалось запустить локальный VLC',
 LOCAL_AUDIO_STOP_UNCONFIRMED:'Не подтверждена остановка локального VLC',
 CENTRAL_RETURN_UNCONFIRMED:'Не подтверждено возвращение центрального потока',
 AUDIO_INTERRUPTED_OR_TIMEOUT:'Воспроизведение прервано или время истекло',
 SERVER_STOP:'Остановка по команде сервера',
 SERVER_HALT:'Исполнение заблокировано сервером'
};
const readinessLabels={
 DEVICE_NOT_BOUND:'Не привязано учебное устройство Windows Agent',
 TRIAL_DISABLED:'Серверный режим изолированного испытания выключен',
 DISPATCH_HALTED:'Общий протокол исполнения заблокирован',
 DEVICE_LEDGER_HALTED:'Очередь устройства заблокирована',
 COMMAND_PENDING:'В очереди уже есть команда',
 LOCAL_OUTPUT_ISOLATION_NOT_ATTESTED:'Сервер не имеет подтверждения физической изоляции громкоговорителей',
 LOCAL_WAV_DIGEST_NOT_BOUND:'Локальный WAV ещё не привязан по SHA-256',
 VERIFIED_ANDROID_EVENT_MISSING:'Нет подтверждённого Android-события',
 ANDROID_EVENT_NOT_FRESH:'Последнее Android-событие устарело'
};
const tone=phase=>phase==='COMPLETE'
 ?'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100'
 :'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-100';

export default function MchsAgentExecutionObservations({token}){
 const [data,setData]=useState(null),[error,setError]=useState('');
 const [readiness,setReadiness]=useState(null),[readinessError,setReadinessError]=useState('');
 const [cycleBusy,setCycleBusy]=useState(false),[cycleNotice,setCycleNotice]=useState('');
 const refresh=useCallback(async()=>{
  try{
   const result=await api('/radio-agent/mchs-agent-event-execution-observations',{token});
   setData(result);setError('');
  }catch(e){setError(e.message||'Не удалось получить результаты Windows Agent');}
 },[token]);
 const refreshReadiness=useCallback(async()=>{
  try{
   const result=await api('/radio-agent/mchs-agent-trial-start-readiness',{token});
   setReadiness(result);setReadinessError('');
  }catch(e){setReadinessError(e.message||'Не удалось проверить готовность учебного START');}
 },[token]);
 const runSyntheticCycle=async()=>{
  if(!window.confirm('Все линии PA и усилитель AA-300 физически отключены? Запустить ОДИН учебный цикл только в наушниках Windows Agent?'))return;
  setCycleBusy(true);setCycleNotice('');
  try{
   const result=await api('/radio-agent/mchs-agent-isolated-synthetic-cycle',{
    method:'POST',token,body:{confirmation:'HEADPHONES_ONLY_PA_DISCONNECTED'}
   });
   setCycleNotice('Учебный цикл поставлен в очередь: '+result.cycleId+
    '. Сначала ALARM, после подтверждённого возврата музыки — отбой.');
   void refresh();void refreshReadiness();
  }catch(e){setCycleNotice('Учебный цикл не запущен: '+(e.message||'ошибка'));}
  finally{setCycleBusy(false);}
 };
 useEffect(()=>{
  void refresh();void refreshReadiness();
  const timer=setInterval(()=>{if(document.visibilityState==='visible'){void refresh();void refreshReadiness();}},15000);
  return()=>clearInterval(timer);
 },[refresh,refreshReadiness]);
 return <section aria-label="Результаты Windows Radio Agent" className="mchs-panel rounded-2xl border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-white/5 p-4 sm:p-5 space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <h3 className="font-semibold text-lg">Выполнение учебных оповещений — Windows Agent</h3>
    <p className="text-sm text-slate-600 dark:text-slate-300">
     Диагностика локального звука в наушниках и возврата центрального эфира. Не подтверждает работу громкоговорителей.
    </p>
   </div>
   <button type="button" onClick={()=>{void refresh();void refreshReadiness();}} className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-sm">Обновить</button>
  </div>
  {error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  {!data&&!error&&<p className="text-sm">Загрузка результатов…</p>}
  {data&&!data.bound&&<p className="text-sm">Учебное устройство Windows Agent не привязано. Результаты недоступны.</p>}
  {data?.bound&&data.items.length===0&&<div role="status" className="rounded-xl border border-amber-300/50 bg-amber-50/60 dark:bg-amber-400/10 p-3 text-sm space-y-2">
   <p className="font-semibold">Сервер не получил результатов учебного аудио Windows Agent.</p>
   <p>Успешное воспроизведение в наушниках само по себе не создаёт запись. Убедитесь, что запущена полная версия Agent не ниже #975, а в его журнале после завершения события есть <code>MCHS_EVENT_OBSERVATION_ACCEPTED</code>.</p>
   <p>Если видна метка <code>MCHS_EVENT_OBSERVATION_RETRY</code>, отчёт не принят сервером: нужно проверить ответ API и авторизацию устройства. Не запускайте настоящую тревогу ради проверки.</p>
  </div>}
  <div aria-label="Готовность учебного START" className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-2 text-sm">
   <p className="font-semibold">Готовность отправки учебного события в Windows Agent</p>
   <p className="text-xs text-slate-600 dark:text-slate-300">Проверка только читает состояние. Она не запускает ALARM, Radio Worker или громкоговорители.</p>
   {readinessError&&<p role="alert" className="text-red-700 dark:text-red-300">{readinessError}</p>}
   {!readiness&&!readinessError&&<p>Проверка готовности…</p>}
   {readiness&&<div className="space-y-2">
    <p>Учебный START: <strong>{readiness.ready?'Готов':'Пока недоступен'}</strong>. В очередь не поставлен.</p>
    <p>Автоматическое Android-испытание (только наушники): <strong>
     {readiness.isolatedAndroidAutoTrialEnabled?'Включено на сервере':'Отключено на сервере'}
    </strong>. Реальное вещание не затрагивается.</p>
    {readiness.isolatedAndroidAutoTrialEnabled&&readiness.agentReadiness&&!readiness.agentReadiness.isolatedTrialSourceAdmission&&
     <p className="text-amber-700 dark:text-amber-300">Windows Agent устарел: локальный обработчик отклоняет учебный START как SOURCE_NOT_VERIFIED. Обновите Python-файлы Agent из main и перезапустите изолированный режим.</p>}
    {readiness.isolatedAndroidAutoTrialEnabled&&!readiness.androidChannelAllowlistConfigured&&
     <p className="text-amber-700 dark:text-amber-300">Не указан разрешённый канал Android-уведомлений: автоматическое испытание не начнётся.</p>}
    {readiness.isolatedAndroidAutoTrialEnabled&&<div className="flex flex-wrap gap-2 items-center">
     <button type="button" disabled={cycleBusy||!readiness.agentReadiness?.centralPacketsConfirmed||!readiness.agentReadiness?.isolatedTrialSourceAdmission}
      onClick={()=>void runSyntheticCycle()}
      className="rounded-xl border border-amber-500 dark:border-amber-400/60 px-3 py-2 font-semibold disabled:opacity-50">
      {cycleBusy?'Запуск учебного цикла…':'Проверить цикл ALARM → отбой в наушниках'}
     </button>
     <span className="text-xs text-slate-600 dark:text-slate-300">Синтетический сценарий без Android-уведомления и без вещания через PA</span>
    </div>}
    {cycleNotice&&<p role="status" className="text-sm">{cycleNotice}</p>}
    {readiness.agentReadiness?<p className="text-xs text-slate-600 dark:text-slate-300">
     Windows Agent: изолированный режим подтверждён самим Agent; локальные WAV заявлены,
     центральные аудиопакеты: <strong>{readiness.agentReadiness.centralPacketsConfirmed?'получены':'не подтверждены'}</strong>.
     Отчёт: {when(readiness.agentReadiness.receivedAt)}. Это сообщение устройства, не проверка проводки PA.
    </p>:<p className="text-xs text-slate-600 dark:text-slate-300">
     Нет свежего сообщения об изолированном режиме Windows Agent (не старше 30 секунд).
    </p>}
    <ul className="list-disc pl-5 space-y-1">
     {(readiness.reasons||[]).map(reason=><li key={reason}>{readinessLabels[reason]||reason}</li>)}
    </ul>
    <p className="text-xs text-slate-600 dark:text-slate-300">Это серверная диагностика, не подтверждение физической изоляции. Не используйте реальную тревогу для теста.</p>
   </div>}
  </div>
  {data?.newestObservationAt&&<p className="text-xs text-slate-600 dark:text-slate-300">Последний полученный отчёт Agent: {when(data.newestObservationAt)}</p>}
  {data?.items?.length>0&&<div className="space-y-2">
   {data.items.map((item,index)=><article key={item.eventId+'-'+index} className="rounded-xl border border-slate-200 dark:border-white/15 p-3 sm:p-4 space-y-2">
    <div className="flex flex-wrap justify-between gap-2 items-start">
     <div>
      <strong className="block">{eventLabel[item.eventType]||'Учебное событие'}</strong>
      <span className="text-xs text-slate-600 dark:text-slate-300 break-all">ID: {item.eventId}</span>
     </div>
     <span className={'rounded-lg border px-2.5 py-1 text-xs font-semibold '+tone(item.phase)}>{stateLabel[item.phase]||'Состояние не определено'}</span>
    </div>
    <div className="grid gap-2 grid-cols-1 sm:grid-cols-3 text-sm">
     <p>Повторы: <strong>{item.completedRepeats}/{item.expectedRepeats}</strong></p>
     <p>Файл: <strong>{item.naturalCompletion?'Завершён естественно':'Завершение не подтверждено'}</strong></p>
     <p>Центральный поток: <strong>{item.centralReturnConfirmed?'Пакеты получены':'Возврат не подтверждён'}</strong></p>
    </div>
    {item.failureReason&&<p role="status" className="text-sm text-red-700 dark:text-red-300">
     Причина: {failureLabel[item.failureReason]||item.failureReason}
    </p>}
    <p className="text-xs text-slate-600 dark:text-slate-300">Отчёт получен: {when(item.receivedAt)} · Только локальный учебный звук, не физический PA</p>
   </article>)}
  </div>}
 </section>;
}
