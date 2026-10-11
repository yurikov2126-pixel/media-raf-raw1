import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import usePageMeta from '../hooks/usePageMeta.js';
export default function Seasons() {
  const {token,user}=useAuth();
  const [enabled,setEnabled]=useState(true),[seasons,setSeasons]=useState([]),[selected,setSelected]=useState(''),[items,setItems]=useState([]),[error,setError]=useState('');
  usePageMeta({title:'Сезоны медиацентра',description:'Правила, награды и рейтинг сезонов'});
  useEffect(()=>{let live=true;api('/gamification/seasons',{token}).then(r=>{if(!live)return;setEnabled(r.enabled!==false);setSeasons(r.seasons||[]);setSelected(r.seasons?.find(s=>s.status==='active')?.slug||r.seasons?.[0]?.slug||'')}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[token]);
  useEffect(()=>{if(!selected)return;let live=true;api('/gamification/seasons/'+encodeURIComponent(selected)+'/leaderboard',{token}).then(r=>{if(live)setItems(r.items||[])}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[selected,token]);
  const season=seasons.find(s=>s.slug===selected);
  return <main className="p-5 md:p-10 max-w-5xl mx-auto space-y-6">
    <div><h1 className="text-3xl font-bold">🏆 Сезоны медиацентра</h1><p className="text-white/60 mt-2">Соревнуйтесь, творите и набирайте XP. Общий опыт и уровень не обнуляются между сезонами.</p></div>
    {error&&<p role="alert" className="text-red-400">{error}</p>}
    {!enabled?<div className="card p-6">Сезонные соревнования временно отключены организаторами.</div>:<>
    <div className="grid sm:grid-cols-3 gap-3">{seasons.map(s=><button type="button" key={s.id} aria-pressed={selected===s.slug} onClick={()=>setSelected(s.slug)} className={'card p-4 text-left '+(selected===s.slug?'ring-2 ring-violet':'')}><strong className="block text-lg">{s.title}</strong><span className="text-xs opacity-60">{s.status==='active'?'Идёт сейчас':s.status==='upcoming'?'Скоро':'Завершён'}</span><p className="text-sm mt-2 opacity-70">{s.description}</p></button>)}</div>
    {season&&<><section className="card p-5 space-y-3"><h2 className="text-xl font-bold">{season.title}</h2><p className="text-sm opacity-60">{new Date(season.startsAt).toLocaleDateString('ru-RU')} — {new Date(season.endsAt).toLocaleDateString('ru-RU')}</p><h3 className="font-semibold">Правила</h3><p className="whitespace-pre-wrap text-sm">{season.rules||'Правила уточняются организаторами.'}</p><h3 className="font-semibold">Награды</h3><p className="whitespace-pre-wrap text-sm">{season.rewards||'Награды будут объявлены.'}</p></section>
    <section className="card p-5 space-y-3"><h2 className="text-xl font-bold">Рейтинг сезона</h2><p className="text-sm opacity-60">Учитываются XP, начисленные в течение выбранного сезона.</p>{items.length===0?<p className="opacity-60">Пока нет результатов.</p>:items.slice(0,100).map((u,i)=><Link to={'/app/u/'+u.username} key={u.id} className={'flex items-center justify-between gap-2 py-2 border-b border-white/10 '+(u.id===user?.id?'text-violet-soft':'')}><span>{i+1}. {u.fullName}{u.id===user?.id?' (вы)':''}</span><strong>{u.xp} XP</strong></Link>)}</section></>}
    </>}
  </main>;
}
