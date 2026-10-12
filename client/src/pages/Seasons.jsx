import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import usePageMeta from '../hooks/usePageMeta.js';
import SeasonCreative from './SeasonCreative.jsx';
import Icon from '../components/Icon.jsx';
export default function Seasons() {
  const {token,user}=useAuth();
  const [results,setResults]=useState([]),[enabled,setEnabled]=useState(true),[seasons,setSeasons]=useState([]),[selected,setSelected]=useState(''),[items,setItems]=useState([]),[error,setError]=useState('');
  const [showCreative,setShowCreative]=useState(false),[showStandings,setShowStandings]=useState(false);
  usePageMeta({title:'Сезоны медиацентра',description:'Правила, награды и рейтинг сезонов'});
  useEffect(()=>{let live=true;api('/gamification/seasons',{token}).then(r=>{if(!live)return;setEnabled(r.enabled!==false);setSeasons(r.seasons||[]);setSelected(r.seasons?.find(s=>s.status==='active')?.slug||r.seasons?.[0]?.slug||'')}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[token]);
  useEffect(()=>{if(!selected)return;let live=true;api('/gamification/seasons/'+encodeURIComponent(selected)+'/leaderboard',{token}).then(r=>{if(live)setItems(r.items||[])}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[selected,token]);
  useEffect(()=>{if(!selected)return;let live=true;api('/gamification/season-works/'+encodeURIComponent(selected)+'/results',{token}).then(r=>{if(live)setResults(r.items||[])}).catch(()=>{if(live)setResults([])});return()=>{live=false}},[selected,token]);
  const visibleSeasons=seasons.filter(s=>s.status==='active'||s.status==='upcoming').sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt)).filter((s,i,arr)=>s.status==='active'||arr.filter(x=>x.status==='upcoming').indexOf(s)===0);
  const season=visibleSeasons.find(s=>s.slug===selected);
  const [expanded,setExpanded]=useState('');
  useEffect(()=>{if(!visibleSeasons.length)return;if(!visibleSeasons.some(s=>s.slug===selected))setSelected(visibleSeasons[0].slug)},[seasons,selected]);
  return <main className="p-5 md:p-10 max-w-5xl mx-auto space-y-6">
    <div className="flex items-center gap-3"><div className="rounded-2xl bg-violet-600/15 p-3 text-violet-500"><Icon name="seasonOrbit" size={34}/></div><div><h1 className="text-2xl font-bold">Сезоны медиацентра</h1><p className="text-sm opacity-65">Творческие вызовы, достижения и награды</p></div></div>
    {error&&<p role="alert" className="text-red-400">{error}</p>}
    {!enabled?<div className="card p-6">Сезонные соревнования временно отключены организаторами.</div>:<>
    <div className="grid gap-3 sm:grid-cols-2">{visibleSeasons.map(s=><button type="button" key={s.id} aria-expanded={expanded===s.slug} onClick={()=>{setSelected(s.slug);setExpanded(v=>v===s.slug?'':s.slug);setShowCreative(false);setShowStandings(false)}} className={'card p-4 text-left transition-colors hover:ring-1 hover:ring-violet-400 '+(selected===s.slug?'ring-2 ring-violet':'')}><span className="flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wide text-violet-500">{s.status==='active'?'● Активный сезон':'◷ Следующий сезон'}</span><Icon name="chevronDown" size={18} className={expanded===s.slug?'rotate-180':''}/></span><strong className="mt-2 block text-lg">{s.title}</strong><span className="text-xs opacity-65">{new Date(s.startsAt).toLocaleDateString('ru-RU')} — {new Date(s.endsAt).toLocaleDateString('ru-RU')}</span></button>)}</div>
    {!visibleSeasons.length&&<p className="card p-5">Пока нет активного или предстоящего сезона.</p>}
    {season&&expanded===season.slug&&<section className="card p-5 space-y-3"><h2 className="text-xl font-bold">{season.title}</h2>{season.description&&<p className="text-sm opacity-75">{season.description}</p>}<h3 className="font-semibold">Правила</h3><p className="whitespace-pre-wrap text-sm">{season.rules||'Правила уточняются организаторами.'}</p><h3 className="font-semibold">Награды</h3><p className="whitespace-pre-wrap text-sm">{season.rewards||'Награды будут объявлены.'}</p><div className="flex flex-wrap gap-2 pt-2"><button type="button" className="btn-primary" aria-expanded={showCreative} onClick={()=>setShowCreative(v=>!v)}>{showCreative?'Скрыть индивидуальные задания':'Показать индивидуальные творческие задания'}</button><button type="button" className="chip" aria-expanded={showStandings} onClick={()=>setShowStandings(v=>!v)}>{showStandings?'Скрыть рейтинги':'Показать рейтинги'}</button></div></section>}
    {season&&expanded===season.slug&&showCreative&&<SeasonCreative key={season.id} slug={season.slug} season={season}/>}
    {season&&expanded===season.slug&&showStandings&&<>
    <section className="card p-5 space-y-3"><h2 className="text-xl font-bold">Итоговый зачёт сезона</h2><p className="text-sm opacity-60">В зачёт попадают только принятые творческие работы. Итог = 70% оценка работы + 30% участие (до 1000 XP).</p>{results.length?results.map(r=><div key={r.user.id} className="flex justify-between border-b border-white/10 py-2"><span>{r.rank}. {r.user.fullName}</span><strong>{r.finalScore}/100 · {r.creativeScore} творчество · {r.xp} XP</strong></div>):<p className="text-sm opacity-60">Пока нет принятых творческих работ.</p>}</section>
    <section className="card p-5 space-y-3"><h2 className="text-xl font-bold">Рейтинг участия (XP)</h2><p className="text-sm opacity-60">Учитываются XP, начисленные в течение выбранного сезона.</p>{items.length===0?<p className="opacity-60">Пока нет результатов.</p>:items.slice(0,100).map((u,i)=><Link to={'/app/u/'+u.username} key={u.id} className={'flex items-center justify-between gap-2 py-2 border-b border-white/10 '+(u.id===user?.id?'text-violet-soft':'')}><span>{i+1}. {u.fullName}{u.id===user?.id?' (вы)':''}</span><strong>{u.xp} XP</strong></Link>)}</section></>}
    </>}
  </main>;
}
