import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';

export default function DashboardWidgets({token}) {
 const [items,setItems]=useState([]),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const load=async()=>{setLoading(true);try{const r=await api('/dashboard-preferences/admin/catalog',{token});setItems(r.widgets||[]);}catch(e){setError(e.message);}finally{setLoading(false);}};
 useEffect(()=>{load();},[token]);
 const edit=(key,patch)=>setItems(current=>current.map(w=>w.key===key?{...w,...patch}:w));
 const add=kind=>{
   const key='custom_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
   setItems(a=>[...a,{key,kind,title:kind==='text'?'Информационный блок':'Полезная ссылка',description:'',content:'',url:'/app',enabled:true}]);
 };
 const remove=key=>setItems(a=>a.filter(w=>w.key!==key));
 const save=async()=>{setSaving(true);setError('');setMessage('');
   try{const r=await api('/dashboard-preferences/admin/catalog',{method:'PUT',token,body:{widgets:items}});setItems(r.widgets);setMessage('Каталог виджетов сохранён');}
   catch(e){setError(e.message||'Не удалось сохранить');}finally{setSaving(false);}
 };
 return <section className="space-y-5">
   <header className="space-y-2"><h2 className="text-xl font-bold">🧩 Виджеты Dashboard 2.0</h2>
     <p className="text-sm opacity-65">Здесь вы определяете доступные пользователям виджеты, их названия и содержимое. Выключенный виджет скрывается у всех, но личный порядок остальных сохраняется. Системные виджеты нельзя удалить.</p></header>
   <div className="flex flex-wrap gap-2">
     <button className="btn-primary min-h-11" type="button" onClick={()=>add('text')}>+ Текстовый виджет</button>
     <button className="btn-ghost min-h-11" type="button" onClick={()=>add('link')}>+ Виджет-ссылка</button>
     <button className="btn-ghost min-h-11" type="button" disabled={saving} onClick={load}>Отменить изменения</button>
   </div>
   {error&&<p role="alert" className="text-red-300 bg-red-500/10 p-3 rounded-lg">{error}</p>}
   {message&&<p role="status" className="text-emerald-300">{message}</p>}
   {loading?<p>Загружаем каталог…</p>:<div className="grid md:grid-cols-2 gap-3">
     {items.map(w=><article key={w.key} className="card p-4 space-y-3 border border-white/10">
       <div className="flex justify-between gap-2 flex-wrap items-center">
         <span className="text-xs opacity-65">{w.kind==='builtin'?'Системный виджет':w.kind==='text'?'Текстовый виджет':'Ссылка'}</span>
         <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={w.enabled!==false} onChange={e=>edit(w.key,{enabled:e.target.checked})}/> Доступен</label>
       </div>
       <label className="block text-xs opacity-80">Название
         <input className="input mt-1 w-full" maxLength={90} value={w.title} onChange={e=>edit(w.key,{title:e.target.value})}/></label>
       <label className="block text-xs opacity-80">Описание
         <input className="input mt-1 w-full" maxLength={240} value={w.description||''} onChange={e=>edit(w.key,{description:e.target.value})}/></label>
       {w.kind==='text'&&<label className="block text-xs opacity-80">Текст блока
         <textarea className="input mt-1 w-full" rows={5} maxLength={1500} value={w.content||''} onChange={e=>edit(w.key,{content:e.target.value})}/></label>}
       {w.kind==='link'&&<><label className="block text-xs opacity-80">Описание ссылки
         <textarea className="input mt-1 w-full" rows={2} maxLength={1500} value={w.content||''} onChange={e=>edit(w.key,{content:e.target.value})}/></label>
         <label className="block text-xs opacity-80">Адрес внутри платформы (начиная с /app)
         <input className="input mt-1 w-full" value={w.url||'/app'} maxLength={400} onChange={e=>edit(w.key,{url:e.target.value})}/></label></>}
       {w.kind!=='builtin'&&<button type="button" className="btn-ghost text-sm" onClick={()=>remove(w.key)}>Удалить виджет</button>}
     </article>)}
   </div>}
   <div className="sticky bottom-3 rounded-xl bg-slate-950/90 p-3 border border-violet-400/30 backdrop-blur">
     <button className="btn-primary min-h-11 w-full sm:w-auto" onClick={save} disabled={saving||loading}>{saving?'Сохраняем…':'Сохранить каталог виджетов'}</button>
   </div>
 </section>;
}
