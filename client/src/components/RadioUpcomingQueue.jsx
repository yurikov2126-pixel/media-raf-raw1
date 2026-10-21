import {useEffect,useState} from 'react';
import {api} from '../api/client.js';

const zone='Europe/Moscow';
const time=v=>v?new Date(v).toLocaleTimeString('ru-RU',{timeZone:zone,hour:'2-digit',minute:'2-digit'}):'—';
const day=v=>v?new Date(v).toLocaleDateString('ru-RU',{timeZone:zone,weekday:'short',day:'numeric',month:'short'}):'—';
const format=ms=>{const n=Math.max(0,Math.round((ms||0)/1000));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};

export default function RadioUpcomingQueue({entries,onSchedule,token,onPlaylists}){
 const [expandedId,setExpandedId]=useState(null);
 const [details,setDetails]=useState({});
 const [error,setError]=useState('');
 const queue=Array.isArray(entries)?entries.slice(0,12):[];
 const expanded=queue.find(e=>e.id===expandedId);
 const playlistId=expanded?.playlistId||expanded?.playlist?.id;
 useEffect(()=>{
  if(!playlistId||!token||details[playlistId])return;
  let active=true;
  api('/radio/playlists/'+encodeURIComponent(playlistId),{token})
   .then(result=>{if(active){setDetails(prev=>({...prev,[playlistId]:{data:result.playlist}}));setError('');}})
   .catch(e=>{if(active){setDetails(prev=>({...prev,[playlistId]:{failed:true}}));setError(e.message||'Состав передачи недоступен');}});
  return()=>{active=false;};
 },[playlistId,token,details]);
 return <section className="radio-v42-queue min-w-0 rounded-2xl border p-4 sm:p-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-[11px] font-bold uppercase tracking-wider opacity-70">Расписание · Москва UTC+3</p>
    <h3 className="mt-1 text-lg font-bold">Очередь передач</h3></div>
   <button type="button" onClick={onSchedule} className="rounded-xl border border-current/20 px-3 py-2 text-xs font-semibold">Открыть календарь ↗</button>
  </div>
  {queue.length?<ol className="mt-4 space-y-2">
   {queue.map((event,index)=>{
    const isOpen=expandedId===event.id;
    const id=event.playlistId||event.playlist?.id;
    const playlist=details[id]?.data;
    const items=playlist?.items||[];
    const live=Date.parse(event.startAt)<=Date.now()&&Date.parse(event.endAt)>Date.now();
    return <li key={event.id||index} className="radio-v42-queue-item overflow-hidden rounded-xl border">
     <button type="button" aria-expanded={isOpen} onClick={()=>setExpandedId(v=>v===event.id?null:event.id)}
      className="flex w-full items-center gap-3 p-3 text-left">
      <span className="radio-v42-queue-time flex w-20 shrink-0 flex-col items-center rounded-lg px-2 py-2">
       <strong className="text-sm tabular-nums">{time(event.startAt)}</strong>
       <span className="text-[10px] whitespace-nowrap">{day(event.startAt)}</span>
      </span>
      <span className="min-w-0 flex-1">
       <span className="block truncate text-sm font-bold">{event.name||event.playlist?.name||event.title||'Радиопередача'}</span>
       <span className="mt-1 block text-xs opacity-80">До {time(event.endAt)} · {live?'По времени сейчас':index===0?'Следующая в сетке':'Запланировано'}</span>
      </span>
      <span className="shrink-0 text-sm" aria-hidden>{isOpen?'⌃':'⌄'}</span>
     </button>
     {isOpen&&<div className="radio-v42-queue-details border-t px-3 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
       <p className="text-xs font-semibold">{id?'Состав плейлиста':'План без привязанного плейлиста'}</p>
       <div className="flex flex-wrap gap-2">
        {id&&onPlaylists&&<button type="button" onClick={()=>onPlaylists(id)} className="rounded-lg border border-current/20 px-3 py-1.5 text-xs">Все плейлисты ↗</button>}
        <button type="button" onClick={onSchedule} className="rounded-lg border border-current/20 px-3 py-1.5 text-xs">В сетку ↗</button>
       </div>
      </div>
      {id&&!token?<p className="text-xs opacity-80">Подробный состав доступен администратору после авторизации.</p>:
       id&&!details[id]?<p role="status" className="text-xs opacity-80">Загрузка состава…</p>:
       id&&details[id]?.failed?<p role="alert" className="text-xs text-rose-600 dark:text-rose-300">{error||'Не удалось загрузить список треков'}</p>:
       items.length?<ol className="max-h-64 space-y-1 overflow-y-auto">
        {items.map((item,i)=><li className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-xs" key={item.id||i}>
         <span className="w-6 shrink-0 tabular-nums opacity-65">{i+1}</span>
         <span className="min-w-0 flex-1 truncate">{item.asset?.name||item.asset?.title||item.name||item.assetId}</span>
         <span className="tabular-nums opacity-70">{format(item.asset?.durationMs||item.durationMs)}</span>
        </li>)}
       </ol>:<p className="text-xs opacity-80">Список аудиозаписей отсутствует.</p>}
      <p className="mt-2 text-xs opacity-70">Это расписание, а не подтверждение текущего звука на выходе.</p>
     </div>}
    </li>;
   })}
  </ol>:<div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm opacity-80">В ближайшей выборке нет передач. Откройте сетку, чтобы добавить эфир.</div>}
 </section>;
}
