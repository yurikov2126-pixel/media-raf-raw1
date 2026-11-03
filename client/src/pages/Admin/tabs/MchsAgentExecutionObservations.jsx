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
const tone=phase=>phase==='COMPLETE'
 ?'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100'
 :'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-100';

export default function MchsAgentExecutionObservations({token}){
 const [data,setData]=useState(null),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  try{
   const result=await api('/radio-agent/mchs-agent-event-execution-observations',{token});
   setData(result);setError('');
  }catch(e){setError(e.message||'Не удалось получить результаты Windows Agent');}
 },[token]);
 useEffect(()=>{
  void refresh();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},15000);
  return()=>clearInterval(timer);
 },[refresh]);
 return <section aria-label="Результаты Windows Radio Agent" className="mchs-panel rounded-2xl border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-white/5 p-4 sm:p-5 space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <h3 className="font-semibold text-lg">Выполнение учебных оповещений — Windows Agent</h3>
    <p className="text-sm text-slate-600 dark:text-slate-300">
     Диагностика локального звука в наушниках и возврата центрального эфира. Не подтверждает работу громкоговорителей.
    </p>
   </div>
   <button type="button" onClick={()=>void refresh()} className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-sm">Обновить</button>
  </div>
  {error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  {!data&&!error&&<p className="text-sm">Загрузка результатов…</p>}
  {data&&!data.bound&&<p className="text-sm">Учебное устройство Windows Agent не привязано. Результаты недоступны.</p>}
  {data?.bound&&data.items.length===0&&<p className="text-sm">Подтверждённых отчётов от Windows Agent пока нет. Это не означает, что предупреждений МЧС не было.</p>}
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
