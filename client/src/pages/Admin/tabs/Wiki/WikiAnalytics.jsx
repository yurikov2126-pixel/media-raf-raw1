import { useEffect, useState } from 'react';
import { api } from '../../../../api/client.js';
export default function WikiAnalytics({token,onClose}) {
 const [data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{api('/admin/wiki/analytics',{token}).then(setData).catch(e=>setError(e.message))},[token]);
 return <div role="dialog" aria-modal="true" aria-label="Аналитика ВикиМедиа" className="fixed inset-0 z-[120] overflow-y-auto bg-black/75 p-3 sm:p-6">
 <div className="card mx-auto max-w-5xl p-5 space-y-4">
 <div className="flex justify-between gap-3 items-center"><h2 className="text-xl font-bold">Аналитика ВикиМедиа</h2><button className="btn-ghost" onClick={onClose}>Закрыть</button></div>
 {error&&<p role="alert" className="text-pink">{error}</p>}
 {!data&&!error&&<p>Загрузка статистики…</p>}
 {data&&<><div className="grid grid-cols-3 gap-2 text-center text-sm">
 {[['Статей',data.totals.articles],['Открытий',data.totals.views],['Закладок',data.totals.bookmarks]].map(([name,val])=><div key={name} className="rounded-xl bg-white/5 p-3"><div className="font-bold text-xl">{val}</div>{name}</div>)}</div>
 <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b border-white/10">{['Статья','Открытия','Читатели','Закладки','Предложения'].map(t=><th key={t} className="px-3 py-2">{t}</th>)}</tr></thead><tbody>{data.articles.map(a=><tr key={a.id} className="border-b border-white/10"><td className="px-3 py-2">{a.title}</td><td className="px-3 py-2">{a.views}</td><td className="px-3 py-2">{a.readers}</td><td className="px-3 py-2">{a.bookmarks}</td><td className="px-3 py-2">{Object.values(a.proposals||{}).reduce((n,v)=>n+v,0)}</td></tr>)}</tbody></table></div>
 <p className="text-xs text-white/50">Открытия не равны уникальным просмотрам. «Читатели» — пользователи с зарегистрированной историей открытия.</p></>}
 </div></div>;
}
