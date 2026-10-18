import {useCallback,useEffect,useState} from 'react';
import {api} from '../api/client.js';
export default function RadioPlayoutHistory({token}){
 const [events,setEvents]=useState([]),[error,setError]=useState('');
 const [insights,setInsights]=useState(null),[hours,setHours]=useState(24),[exporting,setExporting]=useState(false);
 const reload=useCallback(async()=>{try{const data=await api('/radio/playout-history',{token});setEvents(data.events||[]);setError('');}catch(e){setError(e.message);}},[token]);
 useEffect(()=>{api('/radio/playout-insights?hours='+hours,{token}).then(data=>setInsights(data.insights)).catch(e=>setError(e.message));},[hours,token,events.length]);
 const exportCsv=async()=>{
  setExporting(true);
  try{
   const rows=[['Дата','ID','Название','Режим','PCM мс','Смешивание'],...events.map(e=>[e.startedAt,e.id,e.name,e.mode,e.generatedMs||0,e.mixed?'Да':'Нет'])];
   const content='\\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\\r\\n');
   const blob=new Blob([content],{type:'text/csv;charset=utf-8'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='radio-playout-history-last-50.csv';a.click();URL.revokeObjectURL(url);
  }catch(e){setError(e.message);}finally{setExporting(false);}
 };
 useEffect(()=>{reload();const interval=setInterval(reload,30000);return()=>clearInterval(interval);},[reload]);
 return <section className="rounded-2xl border border-current/15 bg-white/5 p-4 sm:p-5 space-y-3">
  <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-lg">История серверного эфира</h3><button type="button" onClick={reload} className="rounded-xl border border-current/20 px-3 py-2 text-xs">Обновить</button></div>
  <div className="flex flex-wrap items-center gap-2">
    <label className="text-xs">Период <select className="rounded-lg border border-current/20 bg-transparent p-2" value={hours} onChange={e=>setHours(Number(e.target.value))}>
     {[1,6,24,72].map(h=><option key={h} value={h}>{h} ч</option>)}</select></label>
    <button type="button" disabled={exporting} onClick={exportCsv} className="rounded-xl border border-current/20 px-3 py-2 text-xs">CSV · последние 50</button>
   </div>
   {insights&&<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
    {[['События',insights.events],['Авто-DJ',insights.autoDj],['По расписанию',insights.scheduled],['Разных треков',insights.uniqueTracks]].map(([label,value])=><div key={label} className="rounded-xl border border-current/10 p-3"><p className="text-xs opacity-60">{label}</p><p className="text-lg font-semibold">{value}</p></div>)}
   </div>}
   {insights?.tracks?.length>0&&<details className="rounded-xl border border-current/15 p-3"><summary className="cursor-pointer text-sm font-semibold">Самые частые композиции</summary>
    <div className="mt-2 space-y-1 text-xs">{insights.tracks.slice(0,10).map(t=><p key={t.id}>{t.name} — {t.plays}</p>)}</div>
   </details>}
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