import {useCallback,useEffect,useState} from 'react';
import {api} from '../api/client.js';
import RadioPlayoutHistory from './RadioPlayoutHistory.jsx';

const fmt=date=>date?new Date(date).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
const number=value=>value===null||value===undefined?'—':Number.isFinite(Number(value))?Number(value):'—';
const badge=(ok,unknown=false)=>unknown?'Нет данных':ok?'Работает':'Требует внимания';
export default function RadioMonitoringCenter({token,onOpen}){
 const [data,setData]=useState(null),[worker,setWorker]=useState(null),[error,setError]=useState('');
 const [lastCheck,setLastCheck]=useState(null),[loading,setLoading]=useState(false),[auto,setAuto]=useState(true);
 const [details,setDetails]=useState(false);
 const refresh=useCallback(async()=>{
  setLoading(true);
  const results=await Promise.allSettled([
   api('/radio-agent/dashboard',{token}),
   api('/radio-agent/dashboard/worker',{token}),
   api('/radio-agent/dashboard/now-playing',{token})
  ]);
  if(results[0].status==='fulfilled')setData(results[0].value);
  else setData(null);
  if(results[1].status==='fulfilled')setWorker(results[1].value);
  else setWorker(null);
  const metadata=results[2].status==='fulfilled'?results[2].value:null;
  setLastCheck({at:Date.now(),metadata,results:results.map(x=>x.status)});
  setError(results.every(x=>x.status==='rejected')?'Мониторинг недоступен: все запросы завершились ошибкой':
   results.some(x=>x.status==='rejected')?'Часть диагностических источников недоступна. Их данные не считаются подтверждёнными.':'');
  setLoading(false);
 },[token]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{if(!auto)return;const t=setInterval(()=>void refresh(),10000);return()=>clearInterval(t);},[auto,refresh]);
 const onAir=lastCheck?.metadata;
 const mode=onAir?.mode||'—';
 const signal=onAir?.available===true&&mode!=='SILENCE'&&mode!=='ERROR';
 const quality=worker?.crossfadeQuality;
 const trans=worker?.transitions;
 const rows=[
  ['Эфирный источник',onAir?badge(signal):'Нет данных',onAir?'Режим: '+mode:'Не получены фактические метаданные'],
  ['PCM Worker',worker?'Данные получены':'Нет данных',worker?'Счётчики доступны':'Нет ответа от диагностики Worker'],
  ['Расписание',data?.cursor?.status||'Нет данных',data?.cursor?.status?'Текущий расчётный курсор':'Нет расчётного курсора'],
  ['Сетевой поток',data?.stream?.status||'Нет данных',data?.stream?.status?'Отчёт сервера':'Нет отчёта о потоке']
 ];
 const counters=[
  ['Попыток кроссфейда',trans?.crossfadeAttempted],
  ['Завершено',trans?.crossfadeCompleted],
  ['Резервных переходов',trans?.crossfadeFallbacks],
  ['Неудачных переходов',trans?.crossfadeFailed],
  ['PCM участков проверено',quality?.inspected],
  ['Подозрительных скачков',quality?.suspiciousJumps]
 ];
 return <section className="space-y-4" aria-label="Radio 3.0: мониторинг вещания">
  <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-current/15 p-4">
   <div><p className="text-[11px] font-bold uppercase tracking-widest opacity-60">RADIO 3.0 · ДИАГНОСТИКА</p>
    <h2 className="text-xl font-bold">Мониторинг станции</h2>
    <p className="mt-1 text-xs opacity-65">Подтверждённые метаданные эфира, телеметрия PCM и история воспроизведения</p></div>
   <div className="flex flex-wrap items-center gap-2">
    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>Автообновление 10 с</label>
    <button type="button" disabled={loading} onClick={refresh} className="rounded-xl border border-current/20 px-3 py-2 text-sm">{loading?'Проверка…':'↻ Проверить'}</button>
   </div>
  </header>
  {error&&<p role="alert" className="rounded-xl border border-amber-500/35 p-3 text-sm text-amber-700 dark:text-amber-300">{error}</p>}
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   {rows.map(([title,status,note])=><div key={title} className="radio-v3-stat rounded-2xl border border-current/15 p-4">
    <p className="text-xs opacity-65">{title}</p><p className="mt-2 break-words text-lg font-bold">{status}</p><p className="mt-2 text-xs opacity-60">{note}</p>
   </div>)}
  </div>
  <div className="grid gap-4 xl:grid-cols-2">
   <section className="rounded-2xl border border-current/15 p-4">
    <h3 className="font-semibold">Фактический источник эфира</h3>
    <p className="mt-3 text-sm"><strong>{onAir?.track?.title||onAir?.track?.name||'Название не подтверждено'}</strong></p>
    <p className="mt-1 text-xs opacity-65">{onAir?.track?.artist||'Исполнитель не указан'} · {mode}</p>
    <p className="mt-3 text-xs opacity-60">Последний ответ: {fmt(lastCheck?.at)}</p>
    <p className="mt-2 text-xs opacity-65">Этот экран не измеряет акустический уровень на Windows-устройстве. Отсутствие телеметрии не означает тишину.</p>
    <div className="mt-4 flex flex-wrap gap-2">
     <button type="button" onClick={()=>onOpen('home')} className="rounded-xl bg-violet-700 px-3 py-2 text-xs font-semibold text-white">Эфирный центр ↗</button>
     <button type="button" onClick={()=>onOpen('equipment')} className="rounded-xl border border-current/20 px-3 py-2 text-xs">Оборудование ↗</button>
    </div>
   </section>
   <section className="rounded-2xl border border-current/15 p-4">
    <h3 className="font-semibold">Переходы и качество PCM</h3>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
     {counters.map(([label,value])=><div className="rounded-xl border border-current/10 p-3" key={label}>
      <p className="text-xs opacity-65">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{number(value)}</p>
     </div>)}
    </div>
    {trans?.lastCrossfade&&<p className="mt-3 text-xs opacity-65">Последний переход: {trans.lastCrossfade.fromId||'—'} → {trans.lastCrossfade.toId||'—'} · {trans.lastCrossfade.completed?'завершён':'не завершён'}</p>}
    <button type="button" className="mt-3 rounded-lg border border-current/20 px-3 py-2 text-xs" onClick={()=>setDetails(v=>!v)}>{details?'Скрыть технические данные':'Технические данные'}</button>
    {details&&<pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify({transitions:trans,crossfadeQuality:quality,lastBoundary:worker?.lastBoundary,liveSourceCrossfade:worker?.liveSourceCrossfade},null,2)}</pre>}
   </section>
  </div>
  <RadioPlayoutHistory token={token}/>
  <p className="text-xs opacity-60">Счётчики PCM отражают события на сервере и не подтверждают, что каждый слушатель получил звук без потерь. Для проверки Windows Radio Agent используйте раздел «Оборудование».</p>
 </section>;
}
