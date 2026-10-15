import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

export default function EditorialWikiRecommendations({task,project,token,canEdit}) {
 const [data,setData]=useState({manual:[],automatic:[],excluded:[]});
 const [catalog,setCatalog]=useState([]);
 const [query,setQuery]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [manage,setManage]=useState(false);
 const base='/editorial/workflow/projects/'+project.id+'/tasks/'+task.id+'/wiki';
 const load=async()=>{setData(await api(base,{token}));};
 useEffect(()=>{let active=true;api(base,{token}).then(value=>{if(active)setData(value)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[base,token]);
 const openManage=async()=>{
   setManage(true);
   try { const result=await api('/wiki/articles?limit=500',{token});setCatalog(Array.isArray(result)?result:result.items||[]); }
   catch(e){setError(e.message)}
 };
 const update=async(articleId,mode)=>{
  setBusy(true);setError('');
  try {await api(base,{method:'PUT',token,body:{articleId,mode}});await load();}
  catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const selectedIds=new Set(data.manual.map(a=>a.id));
 const visible=[...data.manual,...data.automatic.filter(a=>!selectedIds.has(a.id))];
 const filtered=catalog.filter(a=>(a.title+' '+a.excerpt).toLowerCase().includes(query.toLowerCase())).slice(0,25);
 return <section className="rounded-xl border border-violet-300/40 bg-violet-50/70 p-3 text-slate-900 dark:bg-slate-800 dark:text-slate-100 dark:border-violet-500/30">
   <div className="flex flex-wrap justify-between gap-2 items-center"><h3 className="font-semibold">📖 Полезные статьи ВикиМедиа</h3>
   {canEdit&&<button type="button" className="rounded-lg border border-current/20 px-3 py-2 text-xs" onClick={()=>manage?setManage(false):openManage()}>{manage?'Закрыть настройки':'Настроить'}</button>}</div>
   <p className="text-xs opacity-70 mt-1">Рекомендации по теме задания и выбранные редактором материалы.</p>
   {error&&<p role="alert" className="text-sm text-rose-600 mt-2">{error}</p>}
   <div className="space-y-2 mt-3">
     {visible.length===0&&<p className="text-xs opacity-70">Пока нет подходящих статей.</p>}
     {visible.slice(0,8).map(a=><div key={a.id} className="flex items-center gap-2 rounded-lg border border-current/10 p-2 min-w-0">
       <Link className="flex-1 min-w-0 text-sm font-medium underline break-words" to={'/app/wiki/'+a.slug}>{a.title}</Link>
       <span className="text-[10px] shrink-0 opacity-60">{a.source==='manual'?'Закреплено':'Авто'}</span>
       {canEdit&&<button disabled={busy} title={a.source==='manual'?'Убрать ручную привязку':'Исключить рекомендацию'} className="text-xs px-1 shrink-0" onClick={()=>update(a.id,a.source==='manual'?'remove':'exclude')}>✕</button>}
     </div>)}
   </div>
   {canEdit&&manage&&<div className="mt-4 pt-3 border-t border-current/15 space-y-2">
     <label className="text-sm font-semibold block" htmlFor={'wiki-search-'+task.id}>Прикрепить статью вручную</label>
     <input id={'wiki-search-'+task.id} className="input w-full text-sm" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по статьям…" />
     <div className="max-h-56 overflow-y-auto space-y-1">{filtered.map(a=><div className="flex items-center gap-2 text-sm py-2" key={a.id}>
       <span className="min-w-0 flex-1 break-words">{a.title}</span>
       <button disabled={busy} onClick={()=>update(a.id,selectedIds.has(a.id)?'remove':'manual')} className="rounded-lg border border-current/20 px-2 py-1 text-xs shrink-0">{selectedIds.has(a.id)?'Открепить':'Прикрепить'}</button>
     </div>)}</div>
     {data.excluded.length>0&&<button className="text-xs underline" onClick={()=>Promise.all(data.excluded.map(id=>update(id,'remove')))}>Сбросить исключения</button>}
   </div>}
 </section>;
}
