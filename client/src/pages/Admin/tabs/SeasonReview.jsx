import {useEffect,useState} from 'react';
import {api} from '../../../api/client.js';
export default function SeasonReview({token}) {
 const [rows,setRows]=useState([]),[drafts,setDrafts]=useState({}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=()=>api('/gamification/season-works/admin/submissions',{token}).then(r=>setRows(r.submissions||[])).catch(e=>setError(e.message));
 useEffect(()=>{load()},[token]);
 const update=(id,patch)=>setDrafts(d=>({...d,[id]:{...d[id],...patch}}));
 const save=async(row,status)=>{const d=drafts[row.id]||{};setBusy(true);setError('');try{await api('/gamification/season-works/admin/submissions/'+row.id,{method:'PATCH',token,body:{status,score:Number(d.score??row.score??0),feedback:d.feedback??row.feedback,prize:d.prize??row.prize}});await load()}catch(e){setError(e.message)}finally{setBusy(false)}};
 const openFile=async(id)=>{try{const base=import.meta.env.VITE_API||'http://localhost:4000/api';const res=await fetch(base+'/gamification/season-works/files/'+id,{headers:{Authorization:'Bearer '+token}});if(!res.ok)throw new Error('Не удалось открыть файл');const blob=await res.blob(),url=URL.createObjectURL(blob);window.open(url,'_blank','noopener,noreferrer');setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){setError(e.message)}};
 return <section className="card p-5 space-y-4"><div><h3 className="text-xl font-bold">🎬 Проверка творческих работ</h3><p className="text-sm opacity-60">Оценка 0–100: идея 40, техника 30, история 30. Приз назначается вручную после проверки.</p></div>{error&&<p role="alert" className="text-red-400">{error}</p>}
 {!rows.length&&<p className="text-sm opacity-60">Работ пока нет.</p>}
 {rows.map(row=>{const d=drafts[row.id]||{};return <article key={row.id} className="border border-white/10 rounded-xl p-4 space-y-3"><div><strong>{row.user.fullName} · {row.season.title}</strong><p className="text-sm opacity-70">{row.challenge.type==='PHOTO'?'📷':'🎥'} {row.challenge.title} · {row.status}</p><p className="text-sm whitespace-pre-wrap">{row.description}</p></div>
 <div className="flex flex-wrap gap-2">{row.files.map(f=><button key={f.id} className="chip" onClick={()=>openFile(f.id)}>📎 {f.name}</button>)}</div>
 <label className="block text-sm">Оценка (0–100)<input type="number" min="0" max="100" className="input block mt-1 w-28" value={d.score??row.score??0} onChange={e=>update(row.id,{score:e.target.value})}/></label>
 <label className="block text-sm">Отзыв<textarea className="input w-full mt-1" rows={2} value={d.feedback??row.feedback} onChange={e=>update(row.id,{feedback:e.target.value})}/></label>
 <label className="block text-sm">Назначенный приз<input className="input w-full mt-1" value={d.prize??row.prize} onChange={e=>update(row.id,{prize:e.target.value})}/></label>
 <div className="flex flex-wrap gap-2"><button disabled={busy||!row.files.length} className="btn-primary" onClick={()=>save(row,'APPROVED')}>Принять и оценить</button><button disabled={busy} className="chip" onClick={()=>save(row,'REVISION')}>На доработку</button><button disabled={busy} className="chip" onClick={()=>save(row,'REJECTED')}>Отклонить</button></div></article>})}
 </section>;
}
