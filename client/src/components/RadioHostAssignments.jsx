import {useCallback,useEffect,useState} from 'react';
import {api} from '../api/client.js';
import {useAuth} from '../store/auth.jsx';
import {useToast} from '../store/toast.jsx';
const textField='w-full rounded-xl border border-current/20 bg-transparent p-3 text-sm';
const titles={DRAFT:'Черновик',ASSIGNED:'Назначено',REVIEW:'На проверке',RETURNED:'На доработке',APPROVED:'Сценарий утверждён'};
export default function RadioHostAssignments(){
 const {token}=useAuth(),toast=useToast();
 const [episodes,setEpisodes]=useState([]),[selected,setSelected]=useState(null),[script,setScript]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const call=useCallback((route,options)=>api('/radio/student'+route,{token,...options}),[token]);
 const refresh=useCallback(async()=>{const result=await call('/episodes');setEpisodes(result.episodes||[]);return result.episodes||[];},[call]);
 useEffect(()=>{let alive=true;refresh().catch(e=>{if(alive)toast.error(e.message)}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[refresh]);
 const open=e=>{setSelected(e);setScript(e.script||'')};
 const submit=async send=>{if(!selected)return;setBusy(true);try{
  let episode=selected;
  if(script!==episode.script){
   const result=await call('/episodes/'+episode.id+'/script',{method:'PATCH',body:{script,revision:episode.scriptRevision}});
   episode=result.episode;
  }
  if(send){const result=await call('/episodes/'+episode.id+'/submit',{method:'POST'});episode=result.episode;}
  const fresh=await refresh();const updated=fresh.find(e=>e.id===episode.id)||episode;
  setSelected(updated);setScript(updated.script||'');
  toast.success(send?'Сценарий отправлен на проверку':'Сценарий сохранён');
 }catch(e){toast.error(e.message||'Не удалось сохранить')}finally{setBusy(false)}};
 return <section className="space-y-3 rounded-2xl border border-current/15 p-4">
  <header><h2 className="text-lg font-bold">Мои радиозадания</h2><p className="text-xs opacity-70">Сценарии назначенных выпусков Политех-FM. Изменения сохраняются по кнопке.</p></header>
  {loading&&<p className="text-sm opacity-60">Загружаем задания…</p>}
  <div className="grid gap-2 sm:grid-cols-2">{episodes.map(e=><button key={e.id} onClick={()=>open(e)}
   className="rounded-xl border border-current/15 p-3 text-left hover:bg-violet-500/10">
   <span className="block font-semibold text-sm">{e.title}</span>
   <span className="block text-xs opacity-70">{new Date(e.startAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'medium',timeStyle:'short'})} · {titles[e.status]||e.status}</span>
  </button>)}</div>
  {!loading&&!episodes.length&&<p className="text-sm opacity-60">Пока нет назначенных передач.</p>}
  {selected&&<div className="space-y-3 rounded-xl border border-violet-500/25 p-3">
   <div className="flex justify-between gap-2"><div><h3 className="font-semibold">{selected.title}</h3><p className="text-xs opacity-60">{titles[selected.status]||selected.status}</p></div>
    <button onClick={()=>setSelected(null)} aria-label="Закрыть карточку">✕</button></div>
   {selected.reviewReason&&<p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">Замечания редактора: {selected.reviewReason}</p>}
   <label className="block text-sm">Сценарий выпуска<textarea rows={12} value={script} disabled={!['ASSIGNED','DRAFT','RETURNED'].includes(selected.status)||busy}
    onChange={e=>setScript(e.target.value)} className={'mt-2 '+textField}/></label>
   {['ASSIGNED','DRAFT','RETURNED'].includes(selected.status)&&<div className="flex flex-wrap gap-2">
    <button disabled={busy} onClick={()=>submit(false)} className="rounded-lg border border-current/20 px-4 py-2 text-sm">Сохранить текст</button>
    <button disabled={busy||!script.trim()} onClick={()=>submit(true)} className="rounded-lg bg-violet-700 px-4 py-2 text-sm text-white">Отправить на проверку</button>
   </div>}
  </div>}
 </section>;
}
