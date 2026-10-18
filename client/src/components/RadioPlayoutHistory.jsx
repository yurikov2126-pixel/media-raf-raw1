import {useCallback,useEffect,useState} from 'react';
import {api} from '../api/client.js';
export default function RadioPlayoutHistory({token}){
 const [events,setEvents]=useState([]),[error,setError]=useState('');
 const reload=useCallback(async()=>{try{const data=await api('/radio/playout-history',{token});setEvents(data.events||[]);setError('');}catch(e){setError(e.message);}},[token]);
 useEffect(()=>{reload();const interval=setInterval(reload,30000);return()=>clearInterval(interval);},[reload]);
 return <section className="rounded-2xl border border-current/15 bg-white/5 p-4 sm:p-5 space-y-3">
  <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-lg">История серверного эфира</h3><button type="button" onClick={reload} className="rounded-xl border border-current/20 px-3 py-2 text-xs">Обновить</button></div>
  <p className="text-xs opacity-65">Записи подтверждают передачу декодированного PCM в серверный энкодер, а не фактический звук на наушниках или громкоговорителях. Показываются последние 50 событий.</p>
  {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
  <div className="max-h-80 overflow-y-auto divide-y divide-current/10">
   {events.length?events.map((e,i)=><div key={e.startedAt+'-'+e.id+'-'+i} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
    <div className="min-w-0"><p className="font-medium truncate">{e.name||e.id}</p><p className="text-xs opacity-65">{e.mode==='AUTO_DJ'?'Авто-DJ':'Передача'} · {Math.round((e.generatedMs||0)/1000)} с аудио</p></div>
    <time className="text-xs opacity-65">{new Date(e.startedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})}</time>
   </div>):<p className="text-sm opacity-60 py-2">Записей пока нет</p>}
  </div>
 </section>;
}