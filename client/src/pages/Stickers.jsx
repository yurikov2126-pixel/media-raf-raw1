import {useEffect,useState} from 'react';
import {api} from '../api/client.js';
import {useAuth} from '../store/auth.jsx';
import usePageMeta from '../hooks/usePageMeta.js';
export default function Stickers(){
 const {token}=useAuth(),[packs,setPacks]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 usePageMeta({title:'Коллекция стикеров',description:'Собирайте тематические стикеры медиацентра'});
 useEffect(()=>{setLoading(true);api('/stickers/catalog',{token}).then(r=>setPacks(r.packs||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[token]);
 const total=packs.reduce((n,p)=>n+p.stickers.length,0),owned=packs.reduce((n,p)=>n+p.stickers.filter(s=>s.quantity>0).length,0);
 return <div className="p-5 md:p-10 max-w-6xl mx-auto space-y-6"><div><h1 className="text-3xl font-bold">🎴 Моя коллекция стикеров</h1><p className="text-white/60 mt-2">Собирайте тематические наборы, получайте редкие экземпляры за активность и следите за повторами.</p></div>
 <div className="card p-4"><strong>Открыто {owned} из {total}</strong><div className="h-2 bg-white/10 rounded-full mt-3 overflow-hidden"><div className="h-full bg-violet" style={{width:(total?100*owned/total:0)+'%'}}/></div></div>
 {loading&&<p>Загрузка коллекции…</p>}{error&&<p role="alert" className="text-red-400">{error}</p>}
 {packs.map(p=><section key={p.id} className="card p-5 space-y-4"><div><h2 className="text-xl font-bold">{p.title}</h2><p className="text-white/50 text-sm">{p.description} · Собрано {p.stickers.filter(s=>s.quantity>0).length} / {p.stickers.length}</p></div><div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">{p.stickers.map(s=><div key={s.id} className={'rounded-xl border p-3 text-center min-w-0 '+(s.quantity?'border-violet/40 bg-violet/10':'border-white/10 bg-white/5 opacity-45')} title={s.title+' · '+s.rarity}><div className={'text-4xl '+(!s.quantity?'grayscale':'')}>{s.quantity?s.emoji:'❔'}</div><p className="text-xs font-medium mt-2 break-words">{s.quantity?s.title:'Не открыт'}</p><p className="text-[10px] opacity-60">{s.rarity==='LEGENDARY'?'Легендарный':s.rarity==='EPIC'?'Эпический':s.rarity==='RARE'?'Редкий':'Обычный'}</p>{s.quantity>1&&<p className="text-xs font-bold text-violet-soft">×{s.quantity}</p>}</div>)}</div></section>)}</div>;
}
