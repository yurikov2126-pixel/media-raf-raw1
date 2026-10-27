import {useEffect,useMemo,useState} from 'react';

const newDraft=(day)=>({title:'',script:'',day,time:'10:00',durationMin:30,format:'RECORDED',hostIds:[]});
const pad=n=>String(n).padStart(2,'0');
const moscowParts=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(date)).reduce((o,p)=>(o[p.type]=p.value,o),{});
const localDay=date=>{const p=moscowParts(date);return p.year+'-'+p.month+'-'+p.day;};
const localTime=date=>{const p=moscowParts(date);return p.hour+':'+p.minute;};
const statuses={DRAFT:'Черновик',ASSIGNED:'Задание назначено',REVIEW:'На проверке',APPROVED:'Утверждено'};
export default function RadioEditorialCalendar({call,hosts=[],playlists=[],onOpenSchedule}){
 const now=new Date(),initial=localDay(now).slice(0,7);
 const [month,setMonth]=useState(initial),[episodes,setEpisodes]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [publishPlaylistId,setPublishPlaylistId]=useState('');
 const [recurring,setRecurring]=useState(false),[repeatCount,setRepeatCount]=useState(4),[repeatDays,setRepeatDays]=useState([]);
 const [draft,setDraft]=useState(null),[editingId,setEditingId]=useState(null),[view,setView]=useState('month');
 const [refreshKey,setRefreshKey]=useState(0);
 useEffect(()=>{let live=true;setBusy(true);const start=month+'-01T00:00:00+03:00';
  const [y,m]=month.split('-').map(Number),end=new Date(Date.UTC(y,m,1)).toISOString();
  call('/editorial/episodes?from='+encodeURIComponent(new Date(start).toISOString())+'&to='+encodeURIComponent(end))
   .then(x=>{if(live){setEpisodes(x.episodes||[]);setError('');}})
   .catch(e=>{if(live)setError(e.message||'Не удалось загрузить план');})
   .finally(()=>{if(live)setBusy(false);});return()=>{live=false};},[call,month,refreshKey]);
 const days=useMemo(()=>{const [y,m]=month.split('-').map(Number);const first=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7;
  const length=new Date(Date.UTC(y,m,0)).getUTCDate();return [...Array(first).fill(null),...Array.from({length},(_,i)=>i+1)]},[month]);
 const open=(day,episode=null)=>{setRecurring(false);setRepeatDays([]);setPublishPlaylistId(episode?.publishedPlaylistId||'');setEditingId(episode?.id||null);setDraft(episode?{
  title:episode.title,script:episode.script,day:localDay(episode.startAt),time:localTime(episode.startAt),
  durationMin:episode.durationMin,format:episode.format,hostIds:episode.hostIds||[],
  slotId:episode.slotId,status:episode.status,reviewReason:episode.reviewReason,publishedAt:episode.publishedAt,publishedPlaylistId:episode.publishedPlaylistId,liveReady:episode.liveReady
 }:newDraft(month+'-'+pad(day)));setError('');};
 const submit=async(publish=false)=>{if(!draft?.title.trim())return setError('Введите название передачи');
  if(!/^\d{4}-\d\d-\d\d$/.test(draft.day)||!/^\d\d:\d\d$/.test(draft.time))return setError('Укажите дату и время');
  const payload={title:draft.title.trim(),script:draft.script,startAt:new Date(draft.day+'T'+draft.time+':00+03:00').toISOString(),
    durationMin:Number(draft.durationMin),hostIds:draft.hostIds,format:draft.format};
  setBusy(true);setError('');
  try {const result=await call(editingId?'/editorial/episodes/'+editingId:'/editorial/episodes',{
    method:editingId?'PATCH':'POST',body:payload});
   if(publish)await call('/editorial/episodes/'+result.episode.id+'/assign',{method:'POST'});
   setDraft(null);setEditingId(null);setRefreshKey(v=>v+1);
  }catch(e){setError(e.message||'Не удалось сохранить выпуск');}finally{setBusy(false)}};
 const review=async decision=>{
  const reason=decision==='return'?window.prompt('Причина возврата сценария ведущему:',''):'';
  if(decision==='return'&&!reason?.trim())return;
  setBusy(true);setError('');
  try{
   await call('/editorial/episodes/'+editingId+'/review',{method:'POST',body:{decision,reason}});
   setDraft(null);setRefreshKey(v=>v+1);
  }catch(e){setError(e.message||'Не удалось согласовать сценарий')}finally{setBusy(false)}
 };
 const publish=async()=>{
  if(!editingId||!publishPlaylistId)return setError('Выберите утверждённый плейлист');
  setBusy(true);setError('');
  try{await call('/editorial/episodes/'+editingId+'/publish',{method:'POST',body:{playlistId:publishPlaylistId}});
   setDraft(null);setRefreshKey(v=>v+1);
  }catch(e){setError(e.message||'Публикация не удалась')}finally{setBusy(false)}
 };
 const toggleLive=async ready=>{
  setBusy(true);setError('');
  try{const result=await call('/editorial/episodes/'+editingId+'/live-ready',{method:'POST',body:{ready}});
   setDraft(v=>({...v,liveReady:result.episode.liveReady}));setRefreshKey(v=>v+1);
  }catch(e){setError(e.message||'Не удалось изменить готовность')}finally{setBusy(false)}
 };
 const shift=n=>{const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+n,1));setMonth(d.toISOString().slice(0,7));setDraft(null);};
 const byDay=day=>episodes.filter(e=>localDay(e.startAt)===month+'-'+pad(day));
 return <section className="space-y-4">
  <header className="flex flex-wrap justify-between items-center gap-3">
   <div><h2 className="text-xl font-bold">Радиоредакция · план выпусков</h2><p className="text-sm opacity-70">Сценарии, назначения ведущих и связь с эфирной сеткой. Время московское.</p></div>
   <button type="button" onClick={()=>open(Number(localDay(now).slice(-2)))} className="rounded-xl bg-violet-700 px-4 py-2 text-sm text-white">+ Новый выпуск</button>
  </header>
  <div className="flex flex-wrap items-center gap-2">
   <button type="button" onClick={()=>shift(-1)} className="rounded-lg border border-current/20 px-3 py-2" aria-label="Прошлый месяц">←</button>
   <strong className="min-w-32 text-center">{new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'))}</strong>
   <button type="button" onClick={()=>shift(1)} className="rounded-lg border border-current/20 px-3 py-2" aria-label="Следующий месяц">→</button>
   <button type="button" className="rounded-lg border border-current/20 px-3 py-2 text-sm" onClick={()=>setView(v=>v==='month'?'list':'month')}>{view==='month'?'Список':'Календарь'}</button>
   <button type="button" onClick={onOpenSchedule} className="rounded-lg border border-current/20 px-3 py-2 text-sm">Эфирная сетка</button>
  </div>
  {error&&<p role="alert" className="rounded-lg border border-rose-500/30 p-3 text-sm text-rose-600">{error}</p>}
  {busy&&<p className="text-xs opacity-60">Обновляем данные…</p>}
  {view==='month'?<div className="grid grid-cols-7 gap-1" aria-label="Месячное планирование">
   {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=><div key={d} className="p-1 text-center text-xs font-semibold opacity-70">{d}</div>)}
   {days.map((day,i)=>day===null?<div key={'empty'+i} aria-hidden="true"/>:
    <div key={day} className="min-h-24 min-w-0 rounded-lg border border-current/15 p-1 sm:p-2">
     <button type="button" onClick={()=>open(day)} aria-label={'Добавить выпуск '+day+' числа'} className="mb-1 rounded-md px-1 text-sm font-semibold hover:bg-violet-500/10">{day} +</button>
     <div className="space-y-1">{byDay(day).map(e=><button key={e.id} type="button" onClick={()=>open(day,e)}
      className="block w-full truncate rounded-md bg-violet-500/10 px-1 py-1 text-left text-[11px] hover:bg-violet-500/20" title={e.title}>
      {localTime(e.startAt)} {e.title}</button>)}</div>
    </div>)}
  </div>:<div className="space-y-2">{episodes.map(e=><button key={e.id} type="button" onClick={()=>open(1,e)}
   className="w-full rounded-xl border border-current/15 p-3 text-left text-sm hover:bg-violet-500/10">
   <strong>{localDay(e.startAt)} · {localTime(e.startAt)} — {e.title}</strong>
   <span className="block text-xs opacity-65">{statuses[e.status]||e.status} · {e.durationMin} мин · {e.hostIds.length} ведущих</span>
   </button>)}{!episodes.length&&<p className="text-sm opacity-60">Пока нет запланированных выпусков.</p>}</div>}
  {draft&&<div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
   <div className="flex items-center justify-between"><h3 className="font-bold">{editingId?'Карточка выпуска':'Новый выпуск'}</h3><button type="button" onClick={()=>setDraft(null)} aria-label="Закрыть карточку">✕</button></div>
   <label className="block text-sm">Название<input value={draft.title} maxLength={140} onChange={e=>setDraft(v=>({...v,title:e.target.value}))} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2"/></label>
   <div className="grid gap-2 sm:grid-cols-3">
    <label className="text-sm">Дата<input type="date" value={draft.day} disabled={!!draft.slotId} onChange={e=>setDraft(v=>({...v,day:e.target.value}))} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2"/></label>
    <label className="text-sm">Время МСК<input type="time" value={draft.time} disabled={!!draft.slotId} onChange={e=>setDraft(v=>({...v,time:e.target.value}))} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2"/></label>
    <label className="text-sm">Длительность, мин<input type="number" min={1} max={720} value={draft.durationMin} disabled={!!draft.slotId} onChange={e=>setDraft(v=>({...v,durationMin:e.target.value}))} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2"/></label>
   </div>
   <label className="block text-sm">Формат<select value={draft.format} disabled={!!draft.slotId} onChange={e=>setDraft(v=>({...v,format:e.target.value}))} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2"><option value="RECORDED">Запись</option><option value="LIVE">Прямой эфир</option></select></label>
   <fieldset className="space-y-2"><legend className="text-sm font-semibold">Назначенные ведущие</legend>
    <div className="flex flex-wrap gap-2">{hosts.map(h=><label key={h.id} className="flex items-center gap-2 rounded-lg border border-current/15 px-3 py-2 text-sm">
     <input type="checkbox" disabled={!!draft.slotId} checked={draft.hostIds.includes(h.id)} onChange={e=>setDraft(v=>({...v,hostIds:e.target.checked?[...v.hostIds,h.id]:v.hostIds.filter(id=>id!==h.id)}))}/>
     {h.fullName||[h.firstName,h.lastName].filter(Boolean).join(' ')}</label>)}{!hosts.length&&<p className="text-xs opacity-65">Ведущие назначаются через должность «Радиоведущий».</p>}</div>
   </fieldset>
   {!editingId&&<div className="rounded-xl border border-current/15 p-3 space-y-2">
    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={recurring} onChange={e=>setRecurring(e.target.checked)}/>Повторять выпуски</label>
    {recurring&&<><p className="text-xs opacity-70">Для каждого дня будет создано самостоятельное задание и зарезервировано время в сетке. При конфликте серия не создаётся.</p>
     <div className="flex flex-wrap gap-2">{['Вс','Пн','Вт','Ср','Чт','Пт','Сб'].map((name,index)=><label key={index} className="flex items-center gap-1 rounded-md border border-current/15 px-2 py-1 text-xs"><input type="checkbox" checked={repeatDays.includes(index)} onChange={e=>setRepeatDays(v=>e.target.checked?[...v,index]:v.filter(x=>x!==index))}/>{name}</label>)}</div>
     <label className="block text-xs">Количество будущих выпусков<input type="number" min={1} max={31} value={repeatCount} onChange={e=>setRepeatCount(e.target.value)} className="mt-1 block w-24 rounded-lg border border-current/20 bg-transparent p-2"/></label>
    </>}
   </div>}
   <label className="block text-sm">Текст сценария<textarea value={draft.script} rows={9} maxLength={100000} onChange={e=>setDraft(v=>({...v,script:e.target.value}))} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-3" placeholder="Приветствие, подводки, новости, реплики ведущих…"/></label>
   {draft.reviewReason&&<p className="rounded-lg border border-amber-500/30 p-3 text-sm">Последнее замечание: {draft.reviewReason}</p>}
   {draft.slotId?<p className="text-sm text-violet-700 dark:text-violet-300">Место в эфирной сетке зарезервировано. Для изменения времени откройте сетку вещания.</p>:<p className="text-xs opacity-65">Черновик не влияет на эфир. Назначение создаёт планируемый слот без воспроизведения, до выбора утверждённого плейлиста.</p>}
   {draft.status==='APPROVED'&&draft.slotId&&<div className="space-y-2 rounded-xl border border-violet-500/25 p-3">
    <h4 className="font-semibold text-sm">Подготовка к эфиру</h4>
    {draft.format==='RECORDED'?draft.publishedAt?<p className="text-sm text-emerald-700 dark:text-emerald-300">Передача опубликована в эфирную сетку · плейлист закреплён</p>:<>
     <p className="text-xs opacity-70">Выберите утверждённый плейлист. Его реальная длительность будет проверена на конфликты расписания.</p>
     <select value={publishPlaylistId} onChange={e=>setPublishPlaylistId(e.target.value)} className="w-full rounded-lg border border-current/20 bg-transparent p-2 text-sm">
      <option value="">Выберите плейлист</option>
      {playlists.filter(p=>p.status==='APPROVED'&&!p.archivedAt&&p.items?.length).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
     </select>
     <button type="button" onClick={publish} disabled={busy||!publishPlaylistId}
      className="rounded-lg bg-violet-700 px-4 py-2 text-sm text-white disabled:opacity-50">Опубликовать в сетку</button>
    </>:<>
     <p className="text-xs opacity-70">Готовность LIVE не запускает студию и не переключает источник. Запуск эфира — только через действующий эфирный пульт.</p>
     <button type="button" disabled={busy} onClick={()=>toggleLive(!draft.liveReady)}
      className="rounded-lg border border-current/20 px-4 py-2 text-sm">{draft.liveReady?'Снять готовность LIVE':'Подтвердить готовность LIVE'}</button>
     <span className="ml-2 text-xs">{draft.liveReady?'Готово к запуску вручную':'Ожидает подготовки'}</span>
    </>}
   </div>}
   <div className="flex flex-wrap gap-2">
    {!draft.slotId&&<><button type="button" disabled={busy} onClick={()=>submit(false)} disabled={busy||(recurring&&!repeatDays.length)} className="rounded-lg border border-current/20 px-4 py-2 text-sm">Сохранить черновик</button>
    <button type="button" disabled={busy} onClick={()=>submit(true)} disabled={busy||(recurring&&!repeatDays.length)} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white">Назначить и добавить в сетку</button></>}
    {draft.slotId&&<button type="button" disabled={busy} onClick={()=>submit(false)} className="rounded-lg bg-violet-700 px-4 py-2 text-sm text-white">Сохранить сценарий</button>}
    {draft.status==='REVIEW'&&<><button type="button" disabled={busy} onClick={()=>review('approve')} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white">Утвердить сценарий</button>
     <button type="button" disabled={busy} onClick={()=>review('return')} className="rounded-lg border border-rose-500/40 px-4 py-2 text-sm">Вернуть с причиной</button></>}
    {draft.slotId&&<button type="button" onClick={onOpenSchedule} className="rounded-lg border border-current/20 px-4 py-2 text-sm">Открыть сетку</button>}
   </div>
  </div>}
 </section>;
}
