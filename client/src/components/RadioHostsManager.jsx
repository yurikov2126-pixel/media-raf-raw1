import {useEffect,useState} from 'react';
import {api} from '../api/client.js';
export default function RadioHostsManager({token,onChanged}){
 const [hosts,setHosts]=useState([]),[name,setName]=useState(''),[description,setDescription]=useState(''),[editing,setEditing]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const call=(path,options)=>api('/radio'+path,{token,...options});
 const load=async()=>{try{setHosts((await call('/hosts')).hosts||[]);}catch(e){setError(e.message);}};
 useEffect(()=>{void load();},[token]);
 const reset=()=>{setEditing(null);setName('');setDescription('');};
 const save=async e=>{e.preventDefault();setBusy(true);setError('');try{await call(editing?'/hosts/'+editing:'/hosts',{method:editing?'PATCH':'POST',body:{name,description}});reset();await load();onChanged?.();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const remove=async host=>{if(!window.confirm('Удалить ведущего «'+host.name+'»?'))return;setBusy(true);setError('');try{await call('/hosts/'+host.id,{method:'DELETE'});await load();onChanged?.();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="space-y-4">
  <header><p className="text-xs font-bold uppercase tracking-widest opacity-60">ПОЛИТЕХ-FM · КОМАНДА</p><h2 className="mt-1 text-2xl font-bold">Ведущие радиостанции</h2><p className="mt-1 text-sm opacity-70">Создавайте профили ведущих и назначайте их на передачи в разделе «Сетка».</p></header>
  {error&&<p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-300">{error}</p>}
  <form onSubmit={save} className="grid gap-3 rounded-2xl border border-current/15 bg-white/60 p-4 dark:bg-slate-900/40 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
   <label className="text-sm font-semibold">Имя ведущего<input className="mt-1 w-full rounded-xl border border-current/20 bg-transparent px-3 py-2" required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Имя и фамилия"/></label>
   <label className="text-sm font-semibold">О ведущем<input className="mt-1 w-full rounded-xl border border-current/20 bg-transparent px-3 py-2" maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Краткое описание"/></label>
   <div className="flex gap-2"><button disabled={busy||!name.trim()} className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{editing?'Сохранить':'＋ Добавить'}</button>{editing&&<button type="button" className="rounded-xl border border-current/20 px-3" onClick={reset}>Отмена</button>}</div>
  </form>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{hosts.map(h=><article key={h.id} className="rounded-2xl border border-current/15 bg-white/50 p-4 dark:bg-slate-900/40"><div className="flex items-center gap-3"><div className="grid size-12 shrink-0 place-items-center rounded-full bg-violet-500/15 text-xl font-bold text-violet-700 dark:text-violet-300">{h.name[0]}</div><div className="min-w-0"><h3 className="truncate font-bold">{h.name}</h3><p className="line-clamp-2 text-xs opacity-65">{h.description||'Ведущий радиостанции'}</p></div></div><div className="mt-4 flex gap-2"><button type="button" className="rounded-lg border border-current/20 px-3 py-2 text-xs" onClick={()=>{setEditing(h.id);setName(h.name);setDescription(h.description||'');}}>Изменить</button><button type="button" className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs text-rose-600 dark:text-rose-300" disabled={busy} onClick={()=>remove(h)}>Удалить</button></div></article>)}{!hosts.length&&<p className="col-span-full rounded-2xl border border-dashed border-current/20 p-8 text-center text-sm opacity-60">Пока нет ведущих. Добавьте первого ведущего выше.</p>}</div>
 </section>;
}
