import {useEffect,useState} from 'react';
import {api} from '../../../api/client.js';

/** Single operator workspace. Legacy laboratory tools remain server-side but are not primary controls. */
export default function MchsEmergencySimulation({token}){
 const [assets,setAssets]=useState([]),[danger,setDanger]=useState(''),[clear,setClear]=useState('');
 const [typeRules,setTypeRules]=useState(null),[selectedType,setSelectedType]=useState('');
 const [repeats,setRepeats]=useState(1),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
 const [worker,setWorker]=useState(null),[session,setSession]=useState(null),[control,setControl]=useState(null);
 const [monitor,setMonitor]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const refresh=async()=>{
  const results=await Promise.allSettled([
   api('/safety/mchs-training-stream',{token}),
   api('/safety/mchs-training-sequence/status',{token}),
   api('/safety/missile-execution-control',{token}),
   api('/safety/missile-android-monitor',{token})
  ]);
  if(results[0].status==='fulfilled')setWorker(results[0].value);
  if(results[1].status==='fulfilled')setSession(results[1].value.session);
  if(results[2].status==='fulfilled')setControl(results[2].value);
  if(results[3].status==='fulfilled')setMonitor(results[3].value.monitor);
  if(results[0].status==='rejected')setError('Нет связи с Radio Worker');
 };
 useEffect(()=>{
  api('/safety/mchs-training-stream/assets',{token}).then(x=>setAssets(x.assets||[])).catch(()=>setError('Не удалось получить библиотеку ALARM'));
  api('/safety/event-type-rules',{token}).then(setTypeRules).catch(()=>setError('Не удалось получить шаблоны оповещений'));
  api('/safety/mchs-alarm-repeats',{token}).then(x=>setRepeats(x.dangerRepeats||1)).catch(()=>{});
  void refresh();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},5000);
  return()=>clearInterval(timer);
 },[token]);
 const applyTemplate=()=>{
  const rule=typeRules?.rules?.[selectedType];
  if(!rule?.audioAssetId||!assets.some(a=>a.id===rule.audioAssetId)){
   setError('В выбранном шаблоне нет доступного ALARM-трека');return;
  }
  setDanger(rule.audioAssetId);
  setRepeats(rule.repeats||1);
  setMessage('Трек и повторы подставлены. При запуске используются повторы текущего сценария без изменения глобальных настроек.');
  setError('');
 };
 const saveRepeats=async()=>{
  setSaving(true);setMessage('');
  try{await api('/safety/mchs-alarm-repeats',{token,method:'PUT',body:{dangerRepeats:repeats}});setMessage('Повторения сохранены');}
  catch(e){setMessage(e.message||'Не удалось сохранить');}finally{setSaving(false);}
 };
 const start=async()=>{
  if(!window.confirm('УЧЕБНОЕ ВЕЩАНИЕ в основном радиопотоке! Физически отключены громкоговорители, слушатели предупреждены, записи имеют пометку «Учебная тревога»?'))return;
  setBusy(true);setError('');
  try{const r=await api('/safety/mchs-training-sequence',{token,method:'POST',body:{dangerAssetId:danger,clearAssetId:clear,dangerRepeats:repeats,confirmation:'TRAINING_AUDIO_OUTPUT_ACKNOWLEDGED'}});setSession(r.session);}
  catch(e){setError(e.message||'Не удалось запустить');}finally{setBusy(false);}
 };
 const stop=async()=>{
  setBusy(true);setError('');
  try{
   const response=session?.status==='RUNNING'
    ?await api('/safety/mchs-training-sequence/stop',{token,method:'POST'})
    :await api('/safety/mchs-training-stream',{token,method:'POST',body:{action:'STOP'}});
   if(response?.stopConfirmed!==true)throw new Error('Worker не подтвердил выключение ALARM');
   setMessage('STOP подтверждён: звуковой ALARM в Radio Worker остановлен');
   await refresh();
  }catch(e){setError('Остановка не подтверждена: '+(e.message||'нет ответа Worker'));}
  finally{setBusy(false);}
 };
 return <section className="mchs-panel space-y-4">
  <div className="rounded-2xl border border-slate-200 dark:border-white/15 p-4 space-y-2">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <h3 className="font-semibold text-lg">Состояние эфира и МЧС</h3>
    <button className="rounded-lg border px-3 py-2" type="button" onClick={()=>void refresh()}>Обновить</button>
   </div>
   <div className="grid gap-2 sm:grid-cols-2 text-sm">
    <p>Радиопоток: <strong>{worker?.active?'Учебный ALARM':worker?'Обычная программа':'Нет данных'}</strong></p>
    <p>Цикл: <strong>{session?.status||'Не выполняется'}</strong></p>
    <p>Автоматический запуск: <strong>{control?.executionEnabled?'Включён':'Отключён'}</strong></p>
    <p>Обработано Android-событий: <strong>{monitor?.entries?.length??'—'}</strong></p>
    <p>PCM-кадры: <strong>{worker?.lastPcmClock?.frames??'—'}</strong></p>
    <p>Задержки PCM: <strong>{worker?.lastPcmClock?.gaps??'—'}</strong></p>
   </div>
   {control?.holds?.length>0&&<p className="text-xs text-slate-600 dark:text-slate-300">Ограничения автоматики: {control.holds.join(' · ')}</p>}
   {session?.result&&<p role="status" className="text-sm">Последний цикл: {session.result.ok?'Завершён':'Ошибка / остановлен'} · {session.result.reason}</p>}
  </div>
  <div className="rounded-2xl border border-amber-300/60 p-4 space-y-3">
   <h3 className="font-semibold text-lg">Учебный ALARM</h3>
   <p className="text-sm text-amber-700 dark:text-amber-300">Учебные записи звучат в реальном радиопотоке. Перед запуском необходимо физически отключить громкоговорители и предупредить слушателей.</p>
   <div className="rounded-xl border border-slate-300 dark:border-white/20 p-3 space-y-2">
    <label className="block text-sm">Загрузить настройки из шаблона ALARM
     <select value={selectedType} onChange={e=>setSelectedType(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2 text-slate-900 dark:bg-slate-900 dark:text-white">
      <option value="">Выберите тип уведомления</option>
      {(typeRules?.types||[]).map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
     </select>
    </label>
    <button type="button" disabled={!selectedType||busy} onClick={applyTemplate} className="rounded-lg border px-3 py-2 disabled:opacity-50">Подставить трек и повторы</button>
    <p className="text-xs opacity-70">Только заполнение учебного сценария: автоматический ALARM не включается. Отбой выбирается отдельно. Повторы применяются при запуске без отдельного сохранения.</p>
   </div>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm">Тревога<select value={danger} onChange={e=>setDanger(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2 text-slate-900 dark:bg-slate-900 dark:text-white"><option value="">Выбрать ALARM</option>{assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label className="text-sm">Отбой<select value={clear} onChange={e=>setClear(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2 text-slate-900 dark:bg-slate-900 dark:text-white"><option value="">Выбрать ALARM</option>{assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
   </div>
   <div className="flex flex-wrap items-end gap-3">
    <label className="text-sm">Повторы тревоги (1–5)<select value={repeats} onChange={e=>{setRepeats(Number(e.target.value));setMessage('Не сохранено');}} className="mt-1 block rounded-lg border bg-white p-2 text-slate-900 dark:bg-slate-900 dark:text-white">{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    <button type="button" disabled={saving} onClick={()=>void saveRepeats()} className="rounded-lg border px-3 py-2 disabled:opacity-50">Сохранить повторы</button>
    <span role="status" className="text-xs">{message}</span>
   </div>
   <p className="text-xs text-slate-600 dark:text-slate-300">Запись отбоя всегда воспроизводится один раз. Автоматический запуск по Android-уведомлениям пока отключён.</p>
   <div className="flex flex-wrap gap-2">
    <button type="button" disabled={busy||session?.status==='RUNNING'||!danger||!clear||danger===clear} onClick={()=>void start()} className="rounded-lg bg-amber-600 px-4 py-2 text-white disabled:opacity-40">Запустить учебный цикл</button>
    <button type="button" disabled={busy} onClick={()=>void stop()} className="rounded-lg bg-red-700 px-4 py-2 text-white disabled:opacity-50">СТОП / вернуть эфир</button>
   </div>
   {session?.status==='RUNNING'&&<p role="status" className="text-sm">Выполняется: {session.stage||'Подготовка'}</p>}
  </div>
  <div className="rounded-2xl border border-slate-200 dark:border-white/15 p-4 space-y-2">
   <h3 className="font-semibold">Аварийное управление</h3>
   <p className="text-sm text-slate-600 dark:text-slate-300">Дополнительная блокировка автоматического исполнения. Не заменяет физическое отключение усилителя при неисправности.</p>
   <button type="button" className="rounded-lg border border-red-400 px-3 py-2 text-sm" onClick={async()=>{
    try{await api('/safety/missile-execution-journal/halt',{token,method:'POST'});await refresh();}
    catch(e){setError('Блокировка / остановка не подтверждена: '+e.message);}
   }}>Заблокировать исполнение и отправить STOP</button>
  </div>
  {error&&<p role="alert" className="rounded-lg border border-red-400 p-3 text-red-600 dark:text-red-300">{error}</p>}
 </section>;
}
