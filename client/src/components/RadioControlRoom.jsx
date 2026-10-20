import {useCallback,useEffect,useState} from 'react';
import {api} from '../api/client.js';
import {useRadioStreamRecovery} from '../hooks/useRadioStreamRecovery.js';
import {useRadioMetadataSync} from '../hooks/useRadioMetadataSync.js';
import RadioMetadataSyncControl from './RadioMetadataSyncControl.jsx';
import RadioUpcomingQueue from './RadioUpcomingQueue.jsx';
import RadioAmplifierControl from './RadioAmplifierControl.jsx';
const z='Europe/Moscow';
const displayTime=value=>value?new Date(value).toLocaleTimeString('ru-RU',{timeZone:z,hour:'2-digit',minute:'2-digit'}):'—';
const duration=ms=>{const s=Math.max(0,Math.floor((ms||0)/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
const modes={SCHEDULED:'По расписанию',AUTO_DJ:'Auto-DJ',JINGLE:'Джингл',LIVE:'Прямой эфир',SILENCE:'Ожидание / тишина',ERROR:'Ошибка',STARTING:'Запуск'};
export default function RadioControlRoom({token,onOpen}){
 const [data,setData]=useState(null),[worker,setWorker]=useState(null),[error,setError]=useState('');
 const [now,setNow]=useState(()=>Date.now()),[details,setDetails]=useState(false);
 const {audioRef,playing:listening,error:audioError,reconnecting,audioEvents}=useRadioStreamRecovery();
 const {ingest,display:onAir,delay,config,setConfig,automaticMeasured,waiting}=useRadioMetadataSync(audioRef);
 useEffect(()=>{
  let active=true;
  api('/radio-agent/listen/metadata-sync').then(value=>{if(active)setConfig(value);}).catch(()=>{});
  return()=>{active=false;};
 },[setConfig]);
 const saveSyncConfig=(updater)=>{
  const next=typeof updater==='function'?updater(config):updater;
  setConfig(next);
  api('/radio-agent/dashboard/metadata-sync',{token,method:'PUT',body:next})
   .catch(()=>setError('Не удалось сохранить настройку синхронизации на сервере'));
 };
 const refresh=useCallback(async()=>{
  try{
   const report=await api('/radio-agent/dashboard',{token});setData(report);setError('');
   try{ingest(await api('/radio-agent/dashboard/now-playing',{token}));}
   catch{/* Keep last confirmed metadata during a transient API failure. */}
   try{setWorker(await api('/radio-agent/dashboard/worker',{token}));}
   catch{setWorker(null);}
  }catch(e){setError(e.message||'Мониторинг недоступен');setData(null);setWorker(null);}
 },[token]);
 useEffect(()=>{void refresh();const interval=setInterval(refresh,5000);return()=>clearInterval(interval);},[refresh]);
 useEffect(()=>{const interval=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(interval);},[]);
 const track=onAir?.track;
 const current=onAir?.slot;
 const playout=onAir?.playout?.trackId&&onAir.playout.trackId===track?.id?onAir.playout:null;
 const elapsedSinceReport=onAir?.observedAt?Math.min(40000,Math.max(0,now-Date.parse(onAir.observedAt))):0;
 const playedMs=Math.max(0,(playout?.seekMs||0)+(playout?.emittedMs||0)+(playout?.startedAt?elapsedSinceReport:0)-delay*1000);
 const trackMs=playout?.durationMs||track?.durationMs||0;
 const fraction=playout&&trackMs>0?Math.min(100,Math.max(0,100*playedMs/trackMs)):0;
 const isWorking=onAir?.available&&onAir.mode!=='ERROR'&&onAir.mode!=='SILENCE';
 const upcoming=onAir?.upcomingSlot||data?.upcoming?.[0]||null;
 const untilUpcoming=upcoming?.startAt?Math.max(0,new Date(upcoming.startAt).getTime()-now):null;
 return <div className="space-y-4">
  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 radio-panel rounded-2xl border p-3 text-sm dark:bg-slate-900/70">
    <span><strong>Эфир:</strong> {onAir?.available?modes[onAir.mode]||onAir.mode:'Нет связи'}</span>
    <span><strong>Слушателей:</strong> {onAir?.listenerCount??'—'}</span>
    <span><strong>Следующая передача:</strong> {upcoming?displayTime(upcoming.startAt):'Не назначена'}</span>
    <span className="tabular-nums">{untilUpcoming!==null?'Через '+duration(untilUpcoming):''}</span>
    <button className="ml-auto rounded-lg border border-current/15 px-3 py-1.5 text-xs" type="button" onClick={refresh}>Обновить ↻</button>
  </div>
  <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
   <section className="radio-on-air-card relative overflow-hidden rounded-2xl border border-white/15 bg-slate-900 p-5 text-white shadow-xl sm:p-6">
    <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-indigo-400/15 blur-3xl"/>
    <div className="relative flex flex-wrap items-center justify-between gap-3">
     <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-slate-400">Сейчас в эфире</p>
     <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isWorking?'bg-emerald-500/20 text-emerald-300':'bg-amber-500/15 text-amber-300'}`}>
      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-current"/>{onAir?.available?modes[onAir.mode]||onAir.mode:'Связь не подтверждена'}
     </span>
    </div>
    <h2 className="relative mt-6 min-h-16 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">
     {onAir?.available?(current?.name||(onAir.mode==='LIVE'?'Прямой эфир':onAir.mode==='JINGLE'?'Джингл':onAir.mode==='AUTO_DJ'?'Auto-DJ':onAir.mode==='SILENCE'?'Пауза вещания':onAir.mode)):'Нет подтверждения от эфирного сервера'}
    </h2>
    <p className="relative mt-2 truncate text-base text-slate-300">{onAir?.available?(track?[track.artist,track.title].filter(Boolean).join(' — ')||track.name:(onAir.trackId?'Не удалось найти запись в медиатеке':'Нет музыкальной записи')):'Не показываем расчётный трек вместо реального'}</p>
    <div className="relative mt-5 space-y-2">
     <div className="h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Прогресс трека" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction)}>
      <div className="h-full rounded-full bg-indigo-400 transition-[width]" style={{width:fraction+'%'}}/>
     </div>
     <div className="flex justify-between text-xs tabular-nums text-slate-400"><span>{playout?duration(playedMs):'—'}</span><span>{trackMs?duration(trackMs):'—'}</span></div>
     <p className="text-xs text-slate-400">Прогресс с поправкой на задержку относительно PCM Worker. Время станции остаётся серверным.</p>
     <RadioMetadataSyncControl compact config={config} setConfig={saveSyncConfig} delay={delay} automaticMeasured={automaticMeasured}/>
     {waiting&&<p className="text-xs text-amber-300">Калибровка истории треков: первые секунды отображение ориентировочное.</p>}
    </div>
    <div className="relative mt-4 rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
     <p className="text-xs uppercase tracking-widest text-slate-400">Слушать эфир</p>
     <audio ref={audioRef} {...audioEvents} controls preload="none" src="/api/radio-agent/listen" className="w-full" aria-label="Прямой MP3 эфир MEDIA RAF RAW"/>
     <p className="text-xs text-slate-400">{reconnecting?'Переподключение к эфиру':listening?'Воспроизводится публичный MP3':'Нажмите воспроизведение'} · {track?[track.artist,track.title].filter(Boolean).join(' — ')||track.name:'Название появится при выборе трека'}</p>
     {audioError&&<p className="text-xs text-rose-300">{audioError}</p>}
    </div>
    <div className="relative mt-4 rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
     <p className="text-xs uppercase tracking-widest text-slate-400">Далее</p>
     {onAir?.nextTrack?<p className="text-sm font-semibold">{[onAir.nextTrack.artist,onAir.nextTrack.title].filter(Boolean).join(' — ')||onAir.nextTrack.name} <span className="font-normal text-slate-400">(прогноз Auto-DJ)</span></p>:<p className="text-xs text-slate-400">Следующая композиция пока не определена</p>}
     {upcoming&&<p className="text-xs text-slate-300">Ближайший блок сетки: {upcoming.name||upcoming.playlist?.name||"Передача"} · {displayTime(upcoming.startAt)} · через {duration(untilUpcoming)}{upcoming.firstTrack?" · "+upcoming.firstTrack:""}</p>}
    </div>
    {error&&<p role="alert" className="relative mt-3 text-sm text-rose-300">{error}</p>}
    {onAir?.mode==="ERROR"&&onAir?.lastError&&<p role="alert" className="relative mt-3 text-sm text-rose-300">Ошибка вещания. Подробности доступны в технической диагностике.</p>}
    <div className="relative mt-6 flex flex-wrap gap-2">
     <button onClick={()=>onOpen('studio')} type="button" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-200">Открыть студию ↗</button>
     <a href="/radio/live" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">Открыть плеер ↗</a>
     <button onClick={()=>onOpen('schedule')} type="button" className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">Сетка вещания</button>
    </div>
   </section>
   <section className="flex flex-col justify-between radio-panel rounded-2xl p-5">
    <div>
     <p className="text-[11px] font-semibold uppercase tracking-widest opacity-55">Время станции · Москва</p>
     <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">{new Date(now).toLocaleTimeString('ru-RU',{timeZone:z,hour:'2-digit',minute:'2-digit',second:'2-digit'})}</p>
     <p className="mt-1 text-sm opacity-60">{new Date(now).toLocaleDateString('ru-RU',{timeZone:z,weekday:'long',day:'numeric',month:'long'})}</p>
    </div>
    <div className="mt-5 rounded-xl border border-current/10 p-3">
     <p className="text-xs font-semibold uppercase tracking-wider opacity-55">Ближайшая передача</p>
     {upcoming?<p className="mt-1 text-sm font-semibold">{upcoming.name||upcoming.playlist?.name||'Передача'} · {displayTime(upcoming.startAt)}</p>:<p className="mt-1 text-sm opacity-60">В сетке нет ближайших передач</p>}
     <p className="mt-1 text-sm tabular-nums opacity-75">{untilUpcoming!==null?'Начало через '+duration(untilUpcoming):'Ожидание расписания'}</p>
    </div>
   </section>
  </div>
  <section className="radio-panel rounded-2xl border p-4 text-sm space-y-2" aria-label="Диагностика переходов Crossfade">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <h3 className="font-semibold">Диагностика Crossfade</h3>
    <span className="text-xs opacity-65">Данные фактического PCM Worker · обновление 5 с</span>
   </div>
   {!worker?.transitions?<p className="text-xs opacity-65">Телеметрия Worker недоступна — проверьте подключение радиосервера.</p>:
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
     <p className="rounded-lg border border-current/10 p-2">Запущено: <strong>{worker.transitions.crossfadeAttempted??'—'}</strong></p>
     <p className="rounded-lg border border-current/10 p-2">Завершено: <strong>{worker.transitions.crossfadeCompleted??'—'}</strong></p>
     <p className="rounded-lg border border-current/10 p-2">Резервных переходов: <strong>{worker.transitions.crossfadeFallbacks??'—'}</strong></p>
     <p className="rounded-lg border border-current/10 p-2">Ошибок: <strong>{worker.transitions.crossfadeFailed??'—'}</strong></p>
    </div>}
   {worker?.sourceOverlapShadow?.enabled&&<p className="text-xs opacity-70">
    Двухдековая проверка (без влияния на эфир): {worker.sourceOverlapShadow.attempts} попыток ·
    {worker.sourceOverlapShadow.completed} завершено ·
    {worker.sourceOverlapShadow.blocked} отклонено · {worker.sourceOverlapShadow.failed} ошибок
   </p>}
   {worker?.crossfadeQuality&&<p className="text-xs opacity-70">
    Анализ PCM: {worker.crossfadeQuality.inspected} участков ·
    резких скачков сигнала: {worker.crossfadeQuality.suspiciousJumps} ·
    последний скачок: {worker.crossfadeQuality.lastJump} / 65535
   </p>}
   {worker?.transitions?.lastCrossfade&&<p className="text-xs opacity-70">
    Последний переход: {worker.transitions.lastCrossfade.fromId} → {worker.transitions.lastCrossfade.toId}
    · {worker.transitions.lastCrossfade.emittedMs} мс PCM · {worker.transitions.lastCrossfade.completed?'успешно':'прерван'}
   </p>}
   <p className="text-xs opacity-60">Счётчики показывают PCM, переданный кодировщику, а не акустическое качество на устройствах слушателей.</p>
  </section>
  <RadioAmplifierControl token={token}/>
  <section className="flex flex-wrap items-center justify-between gap-3 radio-panel rounded-2xl border p-4 text-sm dark:bg-slate-900/60">
    <div><strong>LIVE-микшер</strong><p className="mt-1 text-xs opacity-65">Входы, мониторинг, маршрутизация и эфирная диагностика</p></div>
    <button type="button" onClick={()=>onOpen('studio')} className="rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white">Открыть LIVE-микшер ↗</button>
  </section>
  <section className="radio-panel rounded-2xl p-4">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><h3 className="font-semibold">Подготовка эфира</h3><p className="text-xs opacity-60">Рабочие инструменты на отдельных экранах — без перегруженной главной страницы</p></div>

   </div>
   <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
    {[['playlists','☷','Собрать плейлист'],['assets','♫','Открыть аудиотеку'],['automation','⟳','Настроить Auto-DJ'],['history','◷','Посмотреть историю']].map(([id,icon,label])=>
     <button key={id} type="button" onClick={()=>onOpen(id)} className="flex items-center gap-3 rounded-xl border border-current/10 bg-white/90 text-slate-900 px-3 py-4 text-left text-sm font-semibold transition hover:border-indigo-400/50 hover:bg-indigo-500/5 dark:bg-slate-900/70 dark:text-slate-100">
      <span className="text-xl" aria-hidden>{icon}</span>{label}<span className="ml-auto opacity-40">→</span></button>)}
   </div>
  </section>
  <RadioUpcomingQueue entries={data?.upcoming} onSchedule={()=>onOpen('schedule')}/>
  <div className="text-right"><button type="button" onClick={()=>setDetails(v=>!v)} className="rounded-xl border border-current/10 px-4 py-2 text-xs opacity-75">{details?'Скрыть сведения':'Дополнительные сведения о состоянии'}</button></div>
  {details&&<section className="rounded-xl border border-current/10 p-4 text-sm"><p>Центральный Worker: {onAir?.mode||'недоступен'} · Расчётный курсор: {data?.cursor?.status||'—'} · Поток: {data?.stream?.status||'—'}</p><p className="mt-2 opacity-65">Данные поступают от существующих API. Мониторинг не включает эфир и не управляет усилителем.</p></section>}
 </div>;
}
