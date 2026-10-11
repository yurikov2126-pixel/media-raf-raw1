import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';
import SeasonChallengesAdmin from './SeasonChallengesAdmin.jsx';
const blank = { slug:'', title:'', description:'', rules:'', rewards:'', startsAt:'', endsAt:'', enabled:true };
const dateInput = s => s ? new Date(s).toISOString().slice(0,16) : '';
export default function SeasonsAdmin({ token }) {
  const [enabled,setEnabled] = useState(true), [seasons,setSeasons] = useState([]);
  const [tasksSeason,setTasksSeason] = useState(null);
  const [draft,setDraft] = useState(null), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  const load = () => api('/admin/seasons',{token}).then(r=>{setEnabled(r.enabled);setSeasons(r.seasons || [])}).catch(e=>setError(e.message));
  useEffect(()=>{load()},[token]);
  const save = async () => {
    setBusy(true);setError('');
    try {
      const body={...draft,startsAt:new Date(draft.startsAt).toISOString(),endsAt:new Date(draft.endsAt).toISOString()};
      await api('/admin/seasons'+(draft.id ? '/'+encodeURIComponent(draft.id):''),{token,method:draft.id?'PUT':'POST',body});
      setDraft(null);await load();
    } catch(e){setError(e.message)}finally{setBusy(false)}
  };
  const toggle = async value => {
    setBusy(true);setError('');
    try { await api('/admin/seasons/enabled',{token,method:'PUT',body:{enabled:value}});setEnabled(value) }
    catch(e){setError(e.message)}finally{setBusy(false)}
  };
  return <section className="card p-5 space-y-4">
    <h3 className="text-lg font-bold">🏆 Управление сезонами</h3>
    <label className="flex gap-2 items-center"><input type="checkbox" checked={enabled} disabled={busy} onChange={e=>toggle(e.target.checked)}/> Сезонная система включена</label>
    <p className="text-sm text-white/50">При отключении сезоны скрываются от участников, история XP сохраняется.</p>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    <div className="space-y-2">{seasons.map(s=><div key={s.id} className="flex items-center justify-between gap-3 border border-white/10 rounded-xl p-3"><div><strong>{s.title}</strong><p className="text-xs opacity-60">{s.enabled?'Доступен':'Скрыт'} · {new Date(s.startsAt).toLocaleDateString('ru-RU')} — {new Date(s.endsAt).toLocaleDateString('ru-RU')}</p></div><button className="chip" onClick={()=>setDraft({...s,startsAt:dateInput(s.startsAt),endsAt:dateInput(s.endsAt)})}>Редактировать</button><button className="chip" onClick={()=>setTasksSeason(tasksSeason===s.id?null:s.id)}>Задания</button></div>)}</div>
    {tasksSeason && <SeasonChallengesAdmin key={tasksSeason} token={token} seasonId={tasksSeason} />}
    <button className="chip" onClick={()=>setDraft({...blank})}>+ Новый сезон</button>
    {draft && <div className="space-y-3 border-t border-white/10 pt-4"><h4 className="font-bold">{draft.id?'Редактирование сезона':'Новый сезон'}</h4>
      {[['title','Название'],['slug','Код (латиница, цифры, дефис)'],['description','Описание'],['rules','Правила участия'],['rewards','Награды']].map(([key,label])=><label key={key} className="block space-y-1"><span className="text-sm">{label}</span>{['description','rules','rewards'].includes(key)?<textarea className="input w-full" rows={key==='rules'?5:3} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/>:<input className="input w-full" value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/>}</label>)}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[['startsAt','Начало'],['endsAt','Окончание']].map(([key,label])=><label key={key} className="space-y-1"><span className="text-sm block">{label}</span><input className="input w-full" type="datetime-local" value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}</div>
      <label className="flex gap-2"><input type="checkbox" checked={draft.enabled} onChange={e=>setDraft({...draft,enabled:e.target.checked})}/> Показывать сезон участникам</label>
      <div className="flex gap-2"><button className="btn-primary" disabled={busy} onClick={save}>Сохранить сезон</button><button className="chip" onClick={()=>setDraft(null)}>Отмена</button></div>
    </div>}
  </section>;
}
