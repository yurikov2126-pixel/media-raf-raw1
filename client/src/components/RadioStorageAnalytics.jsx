import {useEffect,useState} from 'react';
import {api} from '../api/client.js';
const formatBytes=n=>n>=1073741824?(n/1073741824).toFixed(2)+' ГБ':n>=1048576?(n/1048576).toFixed(1)+' МБ':(n/1024).toFixed(0)+' КБ';
export default function RadioStorageAnalytics({token,revision,onFolderOpen}){
 const [open,setOpen]=useState(false),[data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=async()=>{setBusy(true);setError('');try{setData(await api('/radio/assets/storage-analytics',{token}));}catch(e){setError(e.message||'Не удалось получить статистику');}finally{setBusy(false);}};
 useEffect(()=>{if(open)void load();},[open,revision,token]);
 const summary=data?.summary;
 return <section className="rl-analytics rounded-2xl border p-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="rl-eyebrow">АНАЛИТИКА МЕДИАТЕКИ</p><h3 className="mt-1 text-lg font-bold">Хранилище аудиозаписей</h3></div><div className="flex items-center gap-2"><button type="button" className="rl-analytics-button" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>{open?'Свернуть':'Показать аналитику'}</button>{open&&<button type="button" disabled={busy} className="rl-analytics-button" onClick={load}>↻ Обновить</button>}</div></div>
  {open&&<div className="mt-4 space-y-4">
   {error&&<p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-300">{error}</p>}
   {busy&&!data&&<p className="text-sm opacity-60">Загрузка статистики…</p>}
   {summary&&<>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{[['Занято',formatBytes(summary.bytes)],['Записей',summary.count],['Не используются',summary.unusedCount],['Групп дубликатов',summary.duplicateGroups]].map(([label,value])=><div key={label} className="rl-analytics-stat rounded-xl p-3"><p className="text-xs opacity-65">{label}</p><strong className="mt-2 block text-xl tabular-nums">{value}</strong></div>)}</div>
    <div className="grid gap-4 lg:grid-cols-2">
     <div><h4 className="mb-2 text-sm font-bold">Форматы</h4><div className="space-y-2">{data.formats.map(f=><div key={f.format} className="rl-analytics-entry"><div className="flex justify-between gap-2 text-xs"><strong className="uppercase">{f.format}</strong><span>{f.count} · {formatBytes(f.bytes)}</span></div><div className="rl-analytics-track"><div style={{width:(summary.bytes?f.bytes/summary.bytes*100:0)+'%'}}/></div></div>)}</div></div>
     <div><h4 className="mb-2 text-sm font-bold">По папкам</h4><div className="max-h-64 space-y-2 overflow-y-auto">{data.folders.filter(f=>f.count).sort((a,b)=>b.bytes-a.bytes).map(f=><button type="button" key={f.id} className="rl-analytics-entry block w-full text-left" onClick={()=>{onFolderOpen?.(f.id==='root'?null:f.id);setOpen(false);}}><div className="flex justify-between gap-2 text-xs"><strong className="truncate">{f.name}</strong><span>{f.count} · {formatBytes(f.bytes)}</span></div><div className="rl-analytics-track"><div style={{width:(summary.bytes?f.bytes/summary.bytes*100:0)+'%'}}/></div></button>)}</div></div>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
     <div className="rl-analytics-stat rounded-xl p-3"><h4 className="text-sm font-bold">Неиспользуемые записи <span className="opacity-60">({summary.unusedCount})</span></h4><p className="mt-1 text-xs opacity-65">Нет связей с элементами плейлистов. Это не разрешение на автоматическое удаление.</p><p className="mt-1 text-xs font-semibold">Потенциальный объём: {formatBytes(summary.unusedBytes)}</p><div className="mt-3 max-h-52 space-y-1 overflow-y-auto">{data.unused.map(f=><div className="flex justify-between gap-2 text-xs" key={f.id}><span className="min-w-0 truncate">{f.name}</span><span className="shrink-0 opacity-65">{formatBytes(f.byteSize)}</span></div>)}</div></div>
     <div className="rl-analytics-stat rounded-xl p-3"><h4 className="text-sm font-bold">Совпадения SHA-256 <span className="opacity-60">({summary.duplicateGroups})</span></h4><p className="mt-1 text-xs opacity-65">Файлы с одинаковым содержимым. Наличие дубликата не означает, что его можно удалить.</p><p className="mt-1 text-xs font-semibold">Потенциальная экономия: {formatBytes(summary.duplicateBytes)}</p><div className="mt-3 max-h-52 space-y-3 overflow-y-auto">{data.duplicates.map((g,i)=><div key={i} className="border-b border-current/10 pb-2 text-xs"><strong>{g.count} копии · {formatBytes(g.bytesReclaimable)}</strong>{g.files.map(f=><div key={f.id} className="mt-1 truncate opacity-70" title={f.name}>{f.inPlaylist?'🔒 ':''}{f.name}</div>)}</div>)}</div></div>
    </div>
   </>}
  </div>}
 </section>;
}
