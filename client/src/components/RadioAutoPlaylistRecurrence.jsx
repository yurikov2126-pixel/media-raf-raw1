import {useCallback,useEffect,useState} from 'react';
import {api} from '../api/client.js';
const days=[['Вс',0],['Пн',1],['Вт',2],['Ср',3],['Чт',4],['Пт',5],['Сб',6]];
const style='w-full rounded-xl border border-current/20 bg-white px-3 py-2 text-slate-900 dark:bg-slate-900 dark:text-white';
export default function RadioAutoPlaylistRecurrence({token}){
 const call=useCallback((path,options)=>api('/radio'+path,{token,...options}),[token]);
 const [rules,setRules]=useState([]),[auto,setAuto]=useState([]),[folderId,setFolderId]=useState('');
 const [weekdays,setWeekdays]=useState([1,2,3,4,5]),[clock,setClock]=useState('08:00');
 const [automationEnabled,setAutomationEnabled]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  const [r,a,settings]=await Promise.all([call('/auto-playlist-rules'),call('/auto-playlists'),call('/auto-playlist-automation')]);
  setAutomationEnabled(settings.enabled===true);
  setRules(r.rules||[]);setAuto(a.autoPlaylists||[]);
 },[call]);
 useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
 const run=async task=>{setBusy(true);setError('');setNotice('');try{await task();await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const add=e=>{e.preventDefault();run(async()=>{
  const [hour,minute]=clock.split(':').map(Number);
  await call('/auto-playlist-rules',{method:'POST',body:{autoPlaylistId:folderId,weekdays,startMinute:hour*60+minute,enabled:false}});
  setNotice('Правило создано выключенным. Активируйте его после проверки расписания.');
 });};
 const toggle=rule=>run(async()=>{await call('/auto-playlist-rules/'+rule.id,{method:'PATCH',body:{
  weekdays:rule.weekdays,startMinute:rule.startMinute,enabled:!rule.enabled}});
  setNotice('Режим правила обновлён. Уже созданные эфирные слоты не изменяются.');
 });
 const del=rule=>{if(!window.confirm('Удалить правило? Уже созданные эфиры останутся в сетке.'))return;
  run(async()=>{await call('/auto-playlist-rules/'+rule.id,{method:'DELETE'});setNotice('Правило удалено');});
 };
 const changeAutomation=()=>run(async()=>{
  const wanted=!automationEnabled;
  if(wanted&&!window.confirm('Включить автоматическую подготовку будущих эфиров из активных правил? Уже созданные события не изменятся.'))return;
  const response=await call('/auto-playlist-automation',{method:'PUT',body:{enabled:wanted}});
  setAutomationEnabled(response.enabled);
  setNotice(response.enabled?'Автоматическая подготовка включена':'Автоматическая подготовка выключена');
 });
 const prepare=()=>run(async()=>{const r=await call('/auto-playlist-rules/materialize',{method:'POST'});
  setNotice('Создано '+r.summary.created+' · конфликты '+r.summary.conflicts+' · пропущено '+r.summary.skipped+
   (r.summary.errors.length?' · ошибок '+r.summary.errors.length:''));});
 return <section className="space-y-3 rounded-2xl border border-current/15 radio-surface-soft p-4 sm:p-5">
  <div><h3 className="text-lg font-semibold">Регулярные автоплейлисты</h3>
   <p className="mt-1 text-sm opacity-70">Подготовка эфирных слотов на ближайшие 7 дней. Время московское, UTC+3. Созданные эфирные версии больше не меняются.</p></div>
  {error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  {notice&&<p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-current/15 p-3">
   <div><p className="font-semibold text-sm">Автоматическая подготовка эфира</p><p className="text-xs opacity-65">Ежечасно формирует будущие версии на 7 дней из включённых правил</p></div>
   <button type="button" role="switch" aria-checked={automationEnabled} disabled={busy} onClick={changeAutomation}
    className={'rounded-xl px-4 py-2 text-sm font-semibold '+(automationEnabled?'bg-emerald-600 text-white':'border border-current/20')}>
    {automationEnabled?'Включена · выключить':'Выключена · включить'}
   </button>
  </div>
  <form onSubmit={add} className="space-y-3 rounded-xl border border-current/15 p-3">
   <label className="block text-sm">Автоплейлист
    <select className={style} required value={folderId} onChange={e=>setFolderId(e.target.value)}>
     <option value="">Выберите автоплейлист</option>{auto.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
   </label>
   <label className="block text-sm">Время начала по Москве
    <input type="time" required className={style} value={clock} onChange={e=>setClock(e.target.value)}/></label>
   <fieldset><legend className="text-sm">Дни недели</legend><div className="mt-2 flex flex-wrap gap-3">
    {days.map(([label,value])=><label key={value} className="flex items-center gap-1 text-sm">
     <input type="checkbox" checked={weekdays.includes(value)} onChange={e=>setWeekdays(prev=>e.target.checked?[...prev,value]:prev.filter(v=>v!==value))}/>{label}</label>)}
   </div></fieldset>
   <button type="submit" disabled={busy||!weekdays.length} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Добавить правило (выключено)</button>
  </form>
  {rules.map(rule=><div key={rule.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-current/15 p-3 text-sm">
   <div className="min-w-0 flex-1"><p className="font-semibold">{rule.autoPlaylist?.name}</p><p className="opacity-65">
    {String(Math.floor(rule.startMinute/60)).padStart(2,'0')}:{String(rule.startMinute%60).padStart(2,'0')} · {days.filter(([,d])=>rule.weekdays.includes(d)).map(([label])=>label).join(', ')}
   </p></div>
   <button type="button" disabled={busy} onClick={()=>toggle(rule)} className="rounded-lg border border-current/20 px-3 py-2">
    {rule.enabled?'Отключить':'Включить'}</button>
   <button type="button" disabled={busy} onClick={()=>del(rule)} className="rounded-lg border border-red-500/30 px-3 py-2 text-red-700 dark:text-red-300">Удалить</button>
  </div>)}
  <button type="button" onClick={prepare} disabled={busy} className="rounded-xl border border-current/25 px-4 py-2 text-sm">Подготовить ближайшие 7 дней вручную</button>
  <p className="text-xs opacity-65">Переключатель управляет фоновым планировщиком без изменения .env. Конфликтующие слоты не заменяются. Уже созданные слоты остаются в сетке.</p>
 </section>;
}
