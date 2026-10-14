import {useEffect,useState} from 'react';
import {api} from '../../../api/client.js';

const isCandidate=f=>f.status==='untracked'||f.status==='orphan_preview';
const label={investigate:'Требует проверки',keep:'Оставить на хранении',discard:'Признан ненужным'};
export default function StorageTriage({token,files,reviews,onUpdated}){
 const [options,setOptions]=useState({users:[],tasks:[]}),[selected,setSelected]=useState(null),[form,setForm]=useState({}),
 [error,setError]=useState(''),[busy,setBusy]=useState(false),[query,setQuery]=useState(''),[filter,setFilter]=useState('pending');
 useEffect(()=>{let active=true;api('/admin/storage-center/options',{token}).then(d=>{if(active)setOptions(d);}).catch(()=>{});
 return()=>{active=false;};},[token]);
 const reviewMap=new Map(reviews.map(r=>[r.type+':'+r.filename,r]));
 const candidates=files.filter(isCandidate);
 const filtered=candidates.filter(f=>f.name.toLowerCase().includes(query.toLowerCase())&&
  (filter==='all'||(reviewMap.get(f.type+':'+f.storageName)?.decision||'investigate')===filter));
 const select=f=>{setSelected(f);setError('');setForm({name:f.name,owner:'',task:'',mimeType:f.mimeType||'application/octet-stream'});};
 const decide=async decision=>{
   setBusy(true);setError('');
   try{await api('/admin/storage-center/review',{method:'POST',token,body:{type:selected.type,filename:selected.storageName,decision}});
     if(decision!=='investigate')setSelected(null);await onUpdated();
   }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const recover=async()=>{
   setBusy(true);setError('');
   try{
     await api('/admin/storage-center/recover',{method:'POST',token,body:{
       type:selected.type,filename:selected.storageName,name:form.name,uploaderId:form.owner,
       taskId:form.task,mimeType:form.mimeType}});
     setSelected(null);await onUpdated();
   }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <section className="space-y-4">
   <div className="card p-4 space-y-2"><h3 className="font-bold text-lg">Разбор файлов без записи в базе данных</h3>
   <p className="text-sm text-slate-700 dark:text-white/70">Файлы не удаляются автоматически. Проверьте происхождение, назначьте владельца и задание или сохраните до выяснения. Только явно признанные ненужными материалы станут доступны для карантина.</p></div>
   <div className="card p-4 space-y-3">
    <div className="flex flex-wrap gap-2">
      <input aria-label="Поиск обнаруженных файлов" className="input flex-1 min-w-[180px]" placeholder="Поиск по имени…" value={query} onChange={e=>setQuery(e.target.value)}/>
      <select aria-label="Статус проверки" className="input" value={filter} onChange={e=>setFilter(e.target.value)}>
       <option value="pending">Нужно разобрать</option><option value="keep">Оставлены</option><option value="discard">Одобрены для очистки</option><option value="all">Все</option></select>
    </div>
    <p className="text-xs text-slate-600 dark:text-white/60">Найдено: {filtered.length} · Всего неизвестных оригиналов/превью: {candidates.length}</p>
    <div className="divide-y divide-slate-200 dark:divide-white/10 max-h-[560px] overflow-y-auto">
     {filtered.slice(0,300).map(f=><button key={f.type+f.storageName} type="button" onClick={()=>select(f)}
      className="w-full flex items-center text-left gap-3 p-3 hover:bg-slate-100 dark:hover:bg-white/10">
       <span className="text-xl">{f.status==='orphan_preview'?'🖼️':'📁'}</span>
       <span className="min-w-0 flex-1"><strong className="block text-sm break-all">{f.name}</strong>
        <span className="text-xs opacity-65">{f.type==='library'?'Библиотека редакции':'Материалы заданий'} · {f.size} байт</span></span>
       <span className="text-xs rounded-full bg-amber-500/10 text-amber-900 dark:text-amber-200 px-2 py-1">{label[reviewMap.get(f.type+':'+f.storageName)?.decision]||'Требует проверки'}</span>
      </button>)}
    </div>
    {!filtered.length&&<p className="p-3 text-sm opacity-65">Нет файлов с таким статусом.</p>}
   </div>
   {selected&&<div className="fixed inset-0 z-50 bg-black/70 p-3 grid place-items-center" onClick={()=>setSelected(null)}>
    <div role="dialog" aria-modal="true" aria-label="Разбор найденного файла" className="card p-5 w-full max-w-xl max-h-[88vh] overflow-y-auto space-y-3" onClick={e=>e.stopPropagation()}>
      <div className="flex justify-between gap-2"><h3 className="font-bold text-lg break-all">{selected.name}</h3>
       <button className="btn-ghost" aria-label="Закрыть" onClick={()=>setSelected(null)}>✕</button></div>
      <p className="text-xs text-slate-600 dark:text-white/60">Хранилище: {selected.type} · {selected.size} байт. Имя оригинала на диске: {selected.storageName}</p>
      {selected.status==='orphan_preview'?<p className="text-sm text-amber-900 dark:text-amber-200">Это отдельно обнаруженное превью. Восстанавливать запись оригинала по миниатюре нельзя — сначала ищите сам исходник.</p>
      :<div className="space-y-3 border border-slate-200 dark:border-white/10 rounded-xl p-3">
        <h4 className="font-semibold">Восстановить запись в базе данных</h4>
        <label className="text-sm block">Название<input className="input mt-1 w-full" value={form.name||''} maxLength={255} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/></label>
        <label className="text-sm block">Владелец файла<select className="input mt-1 w-full" value={form.owner||''} onChange={e=>setForm(v=>({...v,owner:e.target.value}))}>
          <option value="">Выберите владельца</option>{options.users.map(u=><option key={u.id} value={u.id}>{u.fullName||u.username}</option>)}</select></label>
        {selected.type==='materials'&&<label className="text-sm block">Задание редакции<select className="input mt-1 w-full" value={form.task||''} onChange={e=>setForm(v=>({...v,task:e.target.value}))}>
          <option value="">Выберите существующее задание</option>{options.tasks.map(t=><option key={t.id} value={t.id}>{t.project} · {t.title}</option>)}</select></label>}
        <label className="text-sm block">MIME-тип<input className="input mt-1 w-full" value={form.mimeType||''} maxLength={119} onChange={e=>setForm(v=>({...v,mimeType:e.target.value}))}/></label>
        <button className="btn-primary min-h-11" disabled={busy||!form.name?.trim()||!form.owner||(selected.type==='materials'&&!form.task)} onClick={recover}>Восстановить запись в БД</button>
        <p className="text-xs opacity-65">Создаётся новая запись и привязка к выбранным сущностям. Происхождение и правильность владельца необходимо проверить вручную.</p>
      </div>}
      {error&&<p role="alert" className="text-red-700 dark:text-red-300 text-sm">{error}</p>}
      <div className="flex flex-wrap gap-2">
       <button className="btn-ghost min-h-11" disabled={busy} onClick={()=>decide('keep')}>Оставить на хранении</button>
       <button className="btn-ghost min-h-11" disabled={busy} onClick={()=>decide('investigate')}>Отметить для проверки</button>
       <button className="btn-ghost min-h-11 text-red-700 dark:text-red-300" disabled={busy} onClick={()=>decide('discard')}>Файл не нужен</button>
      </div>
    </div></div>}
 </section>;
}
