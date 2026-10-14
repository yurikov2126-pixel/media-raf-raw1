import {useCallback,useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../../../api/client.js';
const fmt = n => n==null?'—':n>=1073741824?(n/1073741824).toFixed(2)+' ГБ':n>=1048576?(n/1048576).toFixed(1)+' МБ':n>=1024?(n/1024).toFixed(0)+' КБ':n+' Б';
const tabs=[['overview','Обзор'],['files','Файлы'],['links','Связи'],['cleanup','Очистка'],['history','История'],['database','База данных']];
const alertClass='rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200';
const safeLabel={missing:'Оригинал отсутствует',size_mismatch:'Размер отличается',orphan_thumbnail:'Превью без оригинала',untracked:'Нет записи в БД'};
const asDate = d => new Date(d).toLocaleString('ru-RU');
export default function StorageCenter({token}){
 const [tab,setTab]=useState('overview'),[data,setData]=useState(null),[database,setDatabase]=useState(null),[history,setHistory]=useState([]);
 const [selected,setSelected]=useState(null),[query,setQuery]=useState(''),[filter,setFilter]=useState('all');
 const [lastAudit,setLastAudit]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirm,setConfirm]=useState(null);
 const load=useCallback(async()=>{setBusy(true);setError('');
   try{const d=await api('/admin/storage-center/overview',{token});setData(d);
     const [db,h,last]=await Promise.all([api('/admin/storage-center/database',{token}),api('/admin/storage-center/history',{token}),api('/admin/storage-center/audit-last',{token})]);
     setDatabase(db);setHistory(h);setLastAudit(last);
   }catch(e){setError(e.message||'Не удалось получить сведения о хранилище');}finally{setBusy(false);}
 },[token]);
 useEffect(()=>{load();},[load]);
 const act=async(url,body)=>{setBusy(true);setError('');setNotice('');
   try{await api(url,{token,method:'POST',body});setConfirm(null);setNotice('Операция выполнена и записана в журнал');
     await load();
   }catch(e){setError(e.message||'Операция не выполнена');}finally{setBusy(false);}
 };
 const items=useMemo(()=>data?.files?.filter(f=>
   (filter==='all'||filter==='broken'&&f.issues.some(i=>i!=='untracked')||filter==='orphan'&&(f.status==='untracked'||f.status==='orphan_preview')||filter==='used'&&f.status==='linked')&&
   [f.name,f.project,f.task,f.storageName].some(s=>String(s||'').toLowerCase().includes(query.toLowerCase())))||[],[data,query,filter]);
 const overview=data?.stats||{};
 return <div className="space-y-5 max-w-full">
 <div className="flex flex-wrap items-start justify-between gap-3"><div>
   <h2 className="text-2xl font-bold">🗄️ Хранилище и база данных</h2>
   <p className="text-sm text-slate-600 dark:text-white/60 mt-1">Инвентаризация, взаимосвязи файлов и безопасная очистка редакции</p></div>
   <button className="btn-primary min-h-11" disabled={busy} onClick={load}>{busy?'Проверяем…':'↻ Обновить данные'}</button></div>
 {error&&<div role="alert" className={alertClass}>{error}</div>}
 {notice&&<div role="status" className="rounded-xl border border-emerald-500/30 p-3 text-sm text-emerald-800 dark:text-emerald-300">{notice}</div>}
 <div className="flex flex-wrap gap-2">{tabs.map(([id,label])=><button type="button" key={id} aria-pressed={tab===id}
  onClick={()=>setTab(id)} className={`min-h-10 px-3 rounded-xl border text-sm font-medium ${tab===id?'bg-violet-600 border-violet-600 text-white':'border-slate-300 dark:border-white/20 text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10'}`}>{label}</button>)}</div>
 {(tab==='overview'||tab==='cleanup')&&<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
  {[['Записи файлов',overview.registered],['Объём оригиналов',fmt(overview.registeredBytes)],['Без записи в БД',overview.untracked],['Проблемы целостности',overview.broken],
  ['Незарегистрировано',fmt(overview.untrackedBytes)],['Превью без записи',overview.orphanPreviews],['Карантин',overview.quarantineCount],['Размер карантина',fmt(overview.quarantineBytes)],['PostgreSQL',fmt(overview.databaseBytes)]]
   .map(([name,value])=><div className="card p-4" key={name}><div className="text-xs text-slate-600 dark:text-white/60">{name}</div><div className="font-bold text-xl mt-2 tabular-nums">{value??'—'}</div></div>)}</div>}
 {tab==='overview'&&<div className="grid lg:grid-cols-2 gap-3">
 <section className="card p-4 space-y-2"><h3 className="font-bold">Состояние хранилища</h3>
 <p className="text-sm text-slate-700 dark:text-white/75">Проверка сверяет файл на диске с записью PostgreSQL, размером и наличием превью. Ошибки не удаляются автоматически.</p>
 <p className="text-xs text-slate-600 dark:text-white/60">Проверено: {data?.checkedAt?asDate(data.checkedAt):'—'}</p>
 <p className="text-xs text-slate-600 dark:text-white/60">Последний ежедневный аудит: {lastAudit?.checkedAt?asDate(lastAudit.checkedAt):'Ещё не проводился'}</p>
 <button disabled={busy} className="btn-primary min-h-11" onClick={()=>act('/admin/storage-center/audit',{})}>Запустить полный аудит</button></section>
 <section className="card p-4 space-y-2"><h3 className="font-bold">Безопасное удаление</h3>
 <p className="text-sm text-slate-700 dark:text-white/75">Файлы, зарегистрированные в базе, защищены. Несвязанные оригиналы можно поместить в карантин на 30 дней с возможностью восстановления.</p>
 <button className="btn-ghost min-h-11" onClick={()=>setTab('cleanup')}>Перейти к очистке →</button></section>
 </div>}
 {(tab==='files'||tab==='links')&&<div className="card p-4 space-y-3">
   <div className="flex flex-wrap gap-2"><input className="input flex-1 min-w-[180px]" placeholder="Поиск по имени, проекту, заданию…" value={query} onChange={e=>setQuery(e.target.value)}/>
   <select aria-label="Фильтр файлов" className="input" value={filter} onChange={e=>setFilter(e.target.value)}>
   <option value="all">Все файлы</option><option value="used">Без ошибок</option><option value="broken">С проблемами</option><option value="orphan">Без записи в БД</option></select></div>
   <p className="text-xs text-slate-600 dark:text-white/60">Найдено: {items.length}. Нажмите на файл, чтобы увидеть места использования и состояние на диске.</p>
   <div className="divide-y divide-slate-200 dark:divide-white/10 max-h-[620px] overflow-y-auto">
   {items.slice(0,300).map(f=><button key={f.type+f.id} type="button" onClick={()=>setSelected(f)}
   className="w-full text-left py-3 flex flex-wrap sm:flex-nowrap gap-3 items-center hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg px-2">
     <span aria-hidden="true" className="text-2xl">{f.mimeType?.startsWith('image/')?'🖼️':f.mimeType?.startsWith('video/')?'🎬':'📄'}</span>
     <span className="flex-1 min-w-0"><span className="block text-sm font-semibold break-all">{f.name}</span>
     <span className="block text-xs text-slate-600 dark:text-white/60">{f.project|| (f.type==='materials'?'Задание редакции':'Библиотека редакции')} · {fmt(f.size)} · {f.refs.length} связей</span></span>
     <span className={`text-xs rounded-full px-2 py-1 ${f.issues.length?'bg-amber-100 text-amber-950 dark:bg-amber-500/20 dark:text-amber-200':'bg-emerald-100 text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-200'}`}>{f.issues.length?'Проверить':'На месте'}</span>
   </button>)}
   </div>{items.length>300&&<p className="text-xs opacity-70">Показаны первые 300 результатов. Уточните поиск.</p>}
   {!items.length&&<p className="text-sm p-5">Файлы по фильтру не найдены.</p>}
 </div>}
 {tab==='cleanup'&&<div className="space-y-3">
 <div className={alertClass}>Без подтверждения зависимостей зарегистрированные материалы не удаляются. Карантин предназначен только для файлов без записи в базе. Окончательное удаление возможно через 30 дней.</div>
 <h3 className="font-bold">Кандидаты в карантин</h3>
 <div className="card p-3 divide-y divide-slate-200 dark:divide-white/10">
 {(data?.files||[]).filter(f=>f.status==='untracked'||f.status==='orphan_preview').slice(0,100).map(f=><div key={f.type+f.id} className="p-2 flex gap-2 items-center justify-between">
  <span className="text-sm break-all">{f.type} / {f.name} · {fmt(f.size)}</span>
  <button className="btn-ghost text-sm shrink-0 min-h-10" disabled={busy} onClick={()=>setConfirm({kind:'quarantine',file:f})}>В карантин</button></div>)}
 {!data?.stats?.untracked&&!data?.stats?.orphanPreviews&&<p className="p-4 text-sm opacity-70">Незарегистрированных оригиналов и превью не найдено.</p>}
 </div><h3 className="font-bold">Файлы в карантине</h3><div className="card p-3 space-y-2">
 {(data?.quarantine||[]).map(q=><div key={q.id} className="flex flex-wrap gap-3 items-center justify-between border-b border-slate-200 dark:border-white/10 p-2">
 <div className="text-sm break-all">{q.filename}<p className="text-xs opacity-65">Удаление не ранее {asDate(q.expiresAt)} · {fmt(q.size)}</p></div>
 <div className="flex gap-2"><button className="btn-ghost min-h-10" disabled={busy} onClick={()=>act('/admin/storage-center/restore/'+q.id,{})}>Восстановить</button>
 <button className="btn-ghost min-h-10" disabled={busy||new Date(q.expiresAt)>new Date()} onClick={()=>setConfirm({kind:'purge',file:q})}>Удалить навсегда</button></div></div>)}
 {!data?.quarantine?.length&&<p className="text-sm opacity-70 p-3">Карантин пуст.</p>}</div></div>}
 {tab==='history'&&<div className="card p-4 divide-y divide-slate-200 dark:divide-white/10">{history.map(e=><div key={e.id} className="py-3">
 <b className="text-sm">{e.action.replace('storage_','')}</b> <span className="text-xs opacity-65">{asDate(e.at)}</span>
 <div className="text-xs text-slate-600 dark:text-white/60 break-all">{JSON.stringify(e.details)}</div></div>)}
 {!history.length&&<p className="text-sm py-5">Операций пока не зарегистрировано.</p>}</div>}
 {tab==='database'&&<div className="space-y-3"><div className="card p-4"><b>PostgreSQL: {database?.name||'—'}</b><p className="text-sm opacity-65 mt-1">Общий размер {fmt(database?.bytes)}</p>
 <p className="text-xs opacity-65 mt-2">Оценка количества строк может отличаться от фактической до обновления статистики PostgreSQL.</p>
 <Link to="?tab=backups" className="text-sm text-violet-700 dark:text-violet-300 mt-3 inline-block">Резервные копии базы данных →</Link></div>
 <div className="card p-3 divide-y divide-slate-200 dark:divide-white/10">
 {(database?.tables||[]).map(t=><div key={t.name} className="flex justify-between gap-3 py-3 text-sm"><span className="break-all">{t.name}<span className="block text-xs opacity-60">≈ {t.rows} строк</span></span><b className="shrink-0">{fmt(t.bytes)}</b></div>)}</div></div>}
 {selected&&<div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-3" onClick={()=>setSelected(null)}>
  <div role="dialog" aria-modal="true" aria-label="Информация о файле" className="card p-5 w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
  <div className="flex justify-between gap-2"><h3 className="font-bold break-all">{selected.name}</h3><button aria-label="Закрыть" className="btn-ghost" onClick={()=>setSelected(null)}>✕</button></div>
  <div className="text-xs text-slate-600 dark:text-white/65 my-3 space-y-1">
   <p>Хранилище: {selected.type==='library'?'Общая библиотека':'Материалы заданий'}</p>
   <p>ID: {selected.id}</p><p>Оригинал: {selected.storageName}</p><p>Размер: {fmt(selected.size)} · На диске: {fmt(selected.actualSize)}</p>
   <p>Превью: {selected.thumbnail?'Есть ('+fmt(selected.thumbnailBytes)+')':'Нет'}</p>
   <p>Состояние: {selected.issues.length?selected.issues.map(i=>safeLabel[i]||i).join(', '):'Без проблем'}</p>
  </div>
  <h4 className="font-semibold mb-2">Где используется ({selected.refs.length})</h4>
  {selected.refs.length?selected.refs.map((ref,i)=><div key={i} className="rounded-lg border border-slate-200 dark:border-white/10 p-3 text-sm mb-2">
    <b>{ref.type==='task'?'Задание: ':'Общая ссылка: '}{ref.title}</b>
    {ref.project&&<p className="text-xs opacity-65">Проект: {ref.project}</p>}
    {ref.type==='share'&&<p className="text-xs opacity-65">{ref.active?'Активная ссылка':'Ссылка неактивна'}</p>}
    {ref.type==='task'&&<Link className="text-violet-700 dark:text-violet-300 text-xs" to={`/app/editorial/projects?project=${ref.projectId}&task=${ref.id}`}>Перейти в задание →</Link>}
  </div>):<p className="text-sm opacity-65 mb-3">Активных связей не найдено.</p>}
  {selected.status==='orphan_preview'&&<p className="text-xs text-amber-800 dark:text-amber-200 mb-2">Это превью без зарегистрированного оригинала. Его можно переместить в карантин.</p>}
  {selected.thumbnail===false&&selected.actualSize!=null&&selected.id!=='preview:'+selected.storageName&&selected.mimeType?.startsWith('image/')&&<button className="btn-ghost min-h-11 mr-2" disabled={busy} onClick={async()=>{await act('/admin/storage-center/regenerate-thumbnail',{type:selected.type,id:selected.id});setSelected(null);}}>Создать превью</button>}
  {(selected.status==='untracked'||selected.status==='orphan_preview')&&<button className="btn-primary min-h-11" onClick={()=>{setConfirm({kind:'quarantine',file:selected});setSelected(null);}}>Переместить в карантин</button>}
  </div></div>}
 {confirm&&<div className="fixed inset-0 z-[60] bg-black/70 grid place-items-center p-4">
 <div role="alertdialog" aria-modal="true" className="card max-w-md w-full p-5 space-y-3">
  <h3 className="font-bold">Подтвердить операцию</h3><p className="text-sm break-all">{confirm.file.filename||confirm.file.name}</p>
  <p className="text-sm opacity-70">{confirm.kind==='quarantine'?'Файл будет временно перемещён в карантин на 30 дней.': 'Это окончательное удаление без возможности восстановления.'}</p>
  <div className="flex gap-2 justify-end"><button className="btn-ghost min-h-11" onClick={()=>setConfirm(null)}>Отмена</button>
   <button className="btn-primary min-h-11" disabled={busy} onClick={()=>confirm.kind==='quarantine'
   ?act('/admin/storage-center/quarantine',{type:confirm.file.type,filename:confirm.file.storageName})
   :act('/admin/storage-center/purge/'+confirm.file.id,{})}>Подтвердить</button></div>
 </div></div>}
 </div>;
}
