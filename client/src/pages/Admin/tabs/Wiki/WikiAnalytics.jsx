import { useEffect, useState } from 'react';
import { api } from '../../../../api/client.js';
export default function WikiAnalytics({token,onClose}){
 const [rows,setRows]=useState([]),[error,setError]=useState('');
 useEffect(()=>{api('/admin/wiki/analytics',{token}).then(d=>setRows(d.articles||[])).catch(e=>setError(e.message));},[token]);
 return <div className="fixed inset-0 z-[120] bg-black/80 p-3 overflow-y-auto" role="dialog" aria-modal="true">
  <div className="card max-w-5xl mx-auto p-5 space-y-4">
   <div className="flex justify-between items-center gap-3"><h2 className="text-xl font-bold">Аналитика статей</h2><button className="btn-ghost" onClick={onClose}>Закрыть</button></div>
   <p className="text-sm text-white/60">Просмотры — общее число открытий, читатели — число аккаунтов с историей чтения, закладки — сколько пользователей сохранили статью.</p>
   {error&&<p role="alert" className="text-pink">{error}</p>}
   <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th className="p-2">Статья</th><th className="p-2">Просмотры</th><th className="p-2">Читатели</th><th className="p-2">Закладки</th></tr></thead><tbody>{rows.map(a=><tr key={a.id} className="border-t border-white/10"><td className="p-2">{a.title}</td><td className="p-2">{a.views}</td><td className="p-2">{a.readers}</td><td className="p-2">{a.bookmarks}</td></tr>)}</tbody></table></div>
  </div>
 </div>;
}
