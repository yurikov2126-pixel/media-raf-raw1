import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client.js';

const bytes = n => n == null ? '—' : n >= 1073741824 ? (n/1073741824).toFixed(2)+' ГБ' : n >= 1048576 ? (n/1048576).toFixed(1)+' МБ' : n >= 1024 ? (n/1024).toFixed(1)+' КБ' : n+' Б';
const date = d => d ? new Date(d).toLocaleString('ru-RU') : '—';
const key = f => f.type+':'+f.storageName;
const issues = {missing:'Оригинал отсутствует',size_mismatch:'Размер не совпадает',untracked:'Нет записи в БД',orphan_thumbnail:'Лишнее превью'};
const validCandidate = f => f.status==='untracked' || f.status==='orphan_preview';
const tabs = [['overview','Обзор'],['files','Файлы и связи'],['cleanup','Очистка'],['history','История'],['database','База данных']];
const noticeClass = 'rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200';

export default function StorageCenter({token}) {
 const [tab,setTab]=useState('overview'),[data,setData]=useState(null),[database,setDatabase]=useState(null),[history,setHistory]=useState([]),[trend,setTrend]=useState([]);
 const [lastAudit,setLastAudit]=useState(null),[period,setPeriod]=useState(30);
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[store,setStore]=useState('all');
 const [selected,setSelected]=useState(null),[picked,setPicked]=useState(new Set()),[confirm,setConfirm]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[report,setReport]=useState(null);
 const reload=useCallback(async()=>{
   setBusy(true);setError('');
   try{
     const [overview,db,h,previous,historyTrend] = await Promise.all([
      api('/admin/storage-center/overview',{token}),api('/admin/storage-center/database',{token}),
      api('/admin/storage-center/history',{token}),api('/admin/storage-center/audit-last',{token}),
      api('/admin/storage-center/audit-history',{token})]);
     setData(overview);setDatabase(db);setHistory(h);setLastAudit(previous);setTrend(historyTrend||[]);
   }catch(e){setError(e.message||'Не удалось загрузить данные');}
   finally{setBusy(false);}
 },[token]);
 useEffect(()=>{reload();},[reload]);
 const files=data?.files||[],stats=data?.stats||{},quarantine=data?.quarantine||[];
 const candidates=files.filter(validCandidate);
 const shown=useMemo(()=>files.filter(f=>(store==='all'||f.type===store)
  &&(filter==='all'||filter==='candidates'&&validCandidate(f)||filter==='issues'&&f.issues.length||filter==='linked'&&!f.issues.length)
  &&[f.name,f.storageName,f.project,f.task].some(x=>String(x||'').toLowerCase().includes(query.trim().toLowerCase()))),
  [files,store,filter,query]);
 const visibleCandidates=shown.filter(validCandidate);
 const selectedCandidates=candidates.filter(f=>picked.has(key(f)));
 const selectedBytes=selectedCandidates.reduce((s,f)=>s+(f.size||0),0);
 const changePick=(file,checked)=>setPicked(old=>{const n=new Set(old);checked?n.add(key(file)):n.delete(key(file));return n;});
 const selectVisible=()=>setPicked(old=>{const n=new Set(old);visibleCandidates.slice(0,100).forEach(f=>n.add(key(f)));return n;});
 const execute=async()=>{
  setBusy(true);setError('');setMessage('');setReport(null);
  try{
    let result;
    if(confirm.kind==='batch'){
      result=await api('/admin/storage-center/quarantine/batch',{method:'POST',token,body:{items:selectedCandidates.slice(0,100).map(f=>({type:f.type,filename:f.storageName}))}});
      setReport(result.results||[]);setMessage(`В карантине: ${result.success}. Ошибок: ${result.failed}.`);
      setPicked(new Set());
    }else{
      const url=confirm.kind==='restore'?'/admin/storage-center/restore/'+confirm.file.id
        :confirm.kind==='purge'?'/admin/storage-center/purge/'+confirm.file.id
        :confirm.kind==='thumbnail'?'/admin/storage-center/regenerate-thumbnail'
        :'/admin/storage-center/audit';
      await api(url,{method:'POST',token,body:confirm.kind==='thumbnail'?{type:confirm.file.type,id:confirm.file.id}:{}});
      setMessage('Операция выполнена.');
    }
    setConfirm(null);setSelected(null);
    await reload();
  }catch(e){setError(e.message||'Операция не выполнена');}
  finally{setBusy(false);}
 };
 const tile=(name,value,detail)=> <div className="card p-4"><div className="text-xs text-slate-600 dark:text-white/60">{name}</div>
  <div className="font-bold text-xl mt-2 tabular-nums">{value??'—'}</div>{detail&&<p className="text-xs opacity-60 mt-1">{detail}</p>}</div>;
 return <div className="space-y-5">
   <header className="flex flex-wrap justify-between items-start gap-3"><div><h2 className="text-2xl font-bold">🗄️ Хранилище и база данных</h2>
    <p className="text-sm text-slate-600 dark:text-white/65 mt-1">Состояние файлов редакции, связи и безопасная очистка</p></div>
    <button className="btn-ghost min-h-11" disabled={busy} onClick={reload}>{busy?'Проверяем…':'↻ Обновить'}</button></header>
   {error&&<p role="alert" className={noticeClass}>{error}</p>}
   {message&&<p role="status" className="p-3 rounded-xl border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">{message}</p>}
   <nav className="flex flex-wrap gap-2" aria-label="Разделы управления хранилищем">
    {tabs.map(([id,name])=><button type="button" key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}
      className={`px-3 min-h-10 rounded-xl border text-sm ${tab===id?'bg-violet-600 text-white border-violet-600':'border-slate-300 dark:border-white/20 text-slate-800 dark:text-slate-100'}`}>{name}</button>)}
   </nav>
   {tab==='overview'&&<div className="space-y-4">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
     {tile('Файлы редакции',stats.registered,bytes(stats.registeredBytes))}
     {tile('Нужно проверить',stats.broken)}
     {tile('Можно очистить',stats.untracked+(stats.orphanPreviews||0),bytes((stats.untrackedBytes||0)+(stats.orphanPreviewBytes||0)))}
     {tile('В карантине',stats.quarantineCount,bytes(stats.quarantineBytes))}
    </div>
    <div className="grid lg:grid-cols-2 gap-3">
     <section className="card p-4 space-y-3"><h3 className="font-bold">Состояние хранения</h3>
      <p className="text-sm text-slate-700 dark:text-white/70">Сверка оригиналов, записей БД и превью. Автоматический аудит только сообщает о проблемах.</p>
      <p className="text-xs opacity-65">Последняя проверка: {lastAudit?.checkedAt?date(lastAudit.checkedAt):'Ещё не проводилась'}</p>
      <button className="btn-primary min-h-11" onClick={()=>setConfirm({kind:'audit'})} disabled={busy}>Запустить аудит</button></section>
     <section className="card p-4 space-y-3"><h3 className="font-bold">Рекомендована очистка</h3>
      <p className="text-sm opacity-70">Найдено {candidates.length} файлов или превью без записи. Их можно безопасно проверить и переместить в карантин.</p>
      <button className="btn-primary min-h-11" onClick={()=>{setTab('cleanup');setFilter('candidates');}}>Перейти к очистке →</button></section>
    </div>
    <section className="card p-4 space-y-3"><div className="flex gap-3 flex-wrap items-center justify-between">
      <h3 className="font-bold">Динамика занятого места</h3><div className="flex gap-1">{[7,30,90].map(n=><button key={n} aria-pressed={period===n} onClick={()=>setPeriod(n)}
        className={`px-3 py-1 rounded-lg border text-sm ${period===n?'bg-violet-600 text-white':'border-slate-300 dark:border-white/20'}`}>{n} дн.</button>)}</div></div>
      {trend.length?<div className="flex items-end gap-1 h-32">{trend.slice(-period).map((p,i)=>{
       const max=Math.max(1,...trend.slice(-period).map(t=>t.stats?.registeredBytes||0));return <div key={i} title={date(p.checkedAt)+' · '+bytes(p.stats?.registeredBytes||0)}
        className="flex-1 min-w-[2px] rounded-t bg-violet-500/70" style={{height:Math.max(3,(p.stats?.registeredBytes||0)/max*100)+'%'}}/>;})}</div>
       :<p className="text-sm opacity-65">Данные накопятся после ежедневных проверок.</p>}
    </section>
   </div>}
   {(tab==='files'||tab==='cleanup')&&<div className="space-y-4">
    {tab==='cleanup'&&<div className={noticeClass}>Доступны только незарегистрированные оригиналы и лишние превью. Материалы заданий и файлы с записями в БД защищены. После помещения в карантин восстановление возможно 30 дней.</div>}
    <div className="card p-4 space-y-3">
     <div className="flex flex-wrap gap-2">
       <input className="input flex-1 min-w-[180px]" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по имени, проекту, заданию…" aria-label="Поиск файлов"/>
       <select className="input" aria-label="Тип хранилища" value={store} onChange={e=>setStore(e.target.value)}>
        <option value="all">Оба хранилища</option><option value="library">Общая библиотека</option><option value="materials">Материалы заданий</option></select>
       <select className="input" value={tab==='cleanup'?'candidates':filter} onChange={e=>setFilter(e.target.value)} aria-label="Состояние файлов" disabled={tab==='cleanup'}>
        <option value="all">Все состояния</option><option value="candidates">Кандидаты на очистку</option><option value="issues">Проблемные</option><option value="linked">Используются</option></select>
     </div>
     {tab==='cleanup'&&<div className="flex gap-2 flex-wrap items-center border-t border-slate-200 dark:border-white/10 pt-3">
       <button disabled={!visibleCandidates.length||busy} className="btn-ghost min-h-10" onClick={selectVisible}>Выбрать видимые (до 100)</button>
       <button disabled={!picked.size||busy} className="btn-ghost min-h-10" onClick={()=>setPicked(new Set())}>Снять выбор</button>
       <span className="text-sm opacity-70">Выбрано: {selectedCandidates.length} · {bytes(selectedBytes)}</span>
       <button disabled={!selectedCandidates.length||busy} className="btn-primary min-h-11 sm:ml-auto" onClick={()=>setConfirm({kind:'batch'})}>Переместить в карантин</button>
     </div>}
     <p className="text-xs text-slate-600 dark:text-white/60">Найдено {shown.length} файлов. Нажмите на строку для просмотра всех связей.</p>
     <div className="divide-y divide-slate-200 dark:divide-white/10 max-h-[620px] overflow-y-auto">
      {(tab==='cleanup'?shown.filter(validCandidate):shown).slice(0,300).map(f=><div key={key(f)} className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg">
       {tab==='cleanup'&&<input aria-label={'Выбрать '+f.name} type="checkbox" checked={picked.has(key(f))} onChange={e=>changePick(f,e.target.checked)} />}
       <button type="button" className="flex-1 flex items-center min-w-0 text-left gap-3" onClick={()=>setSelected(f)}>
        <span className="text-xl">{f.status==='orphan_preview'?'🖼️':f.mimeType?.startsWith('video/')?'🎬':f.mimeType?.startsWith('image/')?'📸':'📄'}</span>
        <span className="flex-1 min-w-0"><b className="block text-sm break-all">{f.name}</b>
          <span className="block text-xs text-slate-600 dark:text-white/60">{f.project||f.task|| (f.type==='library'?'Общая библиотека':'Материалы заданий')} · {bytes(f.size)} · {f.refs?.length||0} связей</span></span>
        <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${f.issues.length?'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200':'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200'}`}>{f.issues.length?'Проверить':'Используется'}</span>
       </button></div>)}
     </div>
     {!shown.length&&<p className="p-4 text-sm opacity-70">Ничего не найдено.</p>}
     {shown.length>300&&<p className="text-xs opacity-60">Показаны первые 300. Уточните поиск для остальных.</p>}
    </div>
    {tab==='cleanup'&&<section className="card p-4 space-y-3"><h3 className="font-bold">Карантин · {quarantine.length}</h3>
     <p className="text-xs opacity-65">Восстановление доступно сразу. Безвозвратное удаление — только по истечении 30 дней.</p>
     <div className="divide-y divide-slate-200 dark:divide-white/10">
      {quarantine.map(q=><div key={q.id} className="py-3 flex gap-3 items-center justify-between flex-wrap">
        <div className="min-w-0"><b className="text-sm break-all">{q.name||q.filename}</b><p className="text-xs opacity-65">{bytes(q.size)} · до {date(q.expiresAt)}</p></div>
        <div className="flex gap-2"><button className="btn-ghost min-h-10" disabled={busy} onClick={()=>setConfirm({kind:'restore',file:q})}>Восстановить</button>
        <button className="btn-ghost min-h-10" disabled={busy||Date.now()<new Date(q.expiresAt).getTime()} onClick={()=>setConfirm({kind:'purge',file:q})}>Удалить навсегда</button></div></div>)}
     </div>{!quarantine.length&&<p className="text-sm opacity-65">Карантин пуст.</p>}</section>}
    {report&&<section className="card p-4 space-y-2"><h3 className="font-bold">Результаты массовой операции</h3>
     {report.map((x,i)=><p key={i} className={`text-sm break-all ${x.ok?'text-emerald-700 dark:text-emerald-300':'text-red-700 dark:text-red-300'}`}>{x.ok?'✓':'✕'} {x.filename}: {x.ok?'Помещён в карантин':x.error}</p>)}</section>}
   </div>}
   {tab==='history'&&<div className="card p-4 divide-y divide-slate-200 dark:divide-white/10">
    {history.map(h=><div key={h.id} className="py-3"><b className="text-sm">{h.action.replace('storage_','')}</b><span className="text-xs opacity-60 ml-2">{date(h.at)}</span>
     <p className="text-xs opacity-65 break-all">{JSON.stringify(h.details)}</p></div>)}
    {!history.length&&<p className="text-sm opacity-70 p-4">Операций пока нет.</p>}</div>}
   {tab==='database'&&<div className="space-y-3"><div className="card p-4">
    <h3 className="font-bold">PostgreSQL · {database?.name||'—'}</h3><p className="text-sm mt-1">Размер базы: {bytes(database?.bytes)}</p>
    <Link to="?tab=backups" className="text-sm text-violet-700 dark:text-violet-300 mt-2 inline-block">Резервные копии →</Link></div>
    <div className="card p-4 divide-y divide-slate-200 dark:divide-white/10">{(database?.tables||[]).map(t=><div key={t.name} className="flex justify-between gap-3 py-3 text-sm">
      <span className="break-all">{t.name}<span className="block opacity-60 text-xs">≈ {t.rows} строк</span></span><b className="shrink-0">{bytes(t.bytes)}</b></div>)}</div></div>}
   {selected&&<div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-3" onClick={()=>setSelected(null)}>
    <section role="dialog" aria-modal="true" aria-label="Использование файла" className="card p-5 w-full max-w-xl max-h-[85vh] overflow-y-auto space-y-3" onClick={e=>e.stopPropagation()}>
      <div className="flex justify-between gap-3"><h3 className="font-bold break-all">{selected.name}</h3><button className="btn-ghost" onClick={()=>setSelected(null)}>✕</button></div>
      <p className="text-sm opacity-70">Размер: {bytes(selected.size)} · Диск: {bytes(selected.actualSize)} · Превью: {selected.thumbnail?'Есть':'Нет'}</p>
      <p className="text-xs opacity-65 break-all">Хранилище: {selected.type} · {selected.storageName}</p>
      {!!selected.issues.length&&<p className={noticeClass}>{selected.issues.map(i=>issues[i]||i).join(', ')}</p>}
      <h4 className="font-semibold">Места использования ({selected.refs?.length||0})</h4>
      {selected.refs?.map((ref,i)=><div key={i} className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
       <b className="text-sm">{ref.title}</b><p className="text-xs opacity-65">{ref.project|| (ref.active?'Публичный доступ активен':'Публичная ссылка неактивна')}</p>
       {ref.type==='task'&&<Link to={`/app/editorial/projects?project=${encodeURIComponent(ref.projectId||'')}&task=${encodeURIComponent(ref.id)}`}
         className="text-xs text-violet-700 dark:text-violet-300">Открыть задание →</Link>}</div>)}
      {!selected.refs?.length&&<p className="text-sm opacity-65">Связей нет.</p>}
      {selected.status==='untracked' || selected.status==='orphan_preview'
       ? <button className="btn-primary min-h-11" onClick={()=>{changePick(selected,true);setTab('cleanup');setSelected(null);}}>Выбрать для очистки</button>:null}
      {!selected.thumbnail && selected.actualSize!=null && selected.mimeType?.startsWith('image/') &&
       <button className="btn-ghost min-h-11" onClick={()=>{setConfirm({kind:'thumbnail',file:selected});setSelected(null);}}>Создать превью</button>}
    </section></div>}
   {confirm&&<div className="fixed inset-0 z-[60] bg-black/70 grid place-items-center p-4">
     <section role="alertdialog" aria-modal="true" className="card p-5 max-w-lg w-full space-y-3">
      <h3 className="text-lg font-bold">{confirm.kind==='batch'?'Подтверждение массовой очистки':confirm.kind==='purge'?'Безвозвратное удаление':'Подтвердите действие'}</h3>
      {confirm.kind==='batch'?<><p className="text-sm">Будут перемещены в карантин до 100 выбранных файлов.</p>
       <p className="font-bold">{Math.min(100,selectedCandidates.length)} файлов · {bytes(selectedBytes)}</p>
       <p className="text-sm opacity-70">Каждый файл повторно проверяется на сервере. Зарегистрированные материалы удалять нельзя.</p></>
      :<p className="text-sm break-all">{confirm.file?.name||confirm.file?.filename||'Полный аудит хранилища'}</p>}
      <div className="flex gap-2 justify-end"><button className="btn-ghost min-h-11" onClick={()=>setConfirm(null)} disabled={busy}>Отмена</button>
       <button className="btn-primary min-h-11" disabled={busy} onClick={execute}>{busy?'Выполняется…':'Подтвердить'}</button></div>
     </section></div>}
 </div>;
}
