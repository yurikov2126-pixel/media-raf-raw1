import {useCallback,useEffect,useState} from 'react';
import {api} from '../api/client.js';
export default function RadioSourceControl({token}){
 const [handover,setHandover]=useState(null),[data,setData]=useState(null),[error,setError]=useState(''),[note,setNote]=useState(''),[saving,setSaving]=useState(false);
 const load=useCallback(async()=>{try{setData(await api('/radio/source-control',{token}));setError('');}catch(e){setError(e.message);}},[token]);
 useEffect(()=>{load();},[load]);
 const save=async()=>{
  if(!data)return;
  setSaving(true);setNote('');
  try{const res=await api('/radio/source-control',{token,method:'PUT',body:data.settings});
   setData(v=>({...v,settings:res.settings}));setNote('Политика сохранена. Подключение микрофона к серверному PCM пока отключено.');}
  catch(e){setError(e.message);}finally{setSaving(false);}
 };
 if(!data)return <section className="rounded-2xl border border-current/15 p-4 text-sm">{error||'Загрузка управления эфиром…'}</section>;
 const settings=data.settings;
 return <section className="rounded-2xl border border-current/15 bg-white/5 p-4 sm:p-5 space-y-4">
  <header className="space-y-1"><h2 className="font-semibold text-lg">Управление источниками · Прямой эфир 2.0</h2>
   <p className="text-xs opacity-65">Подготовка приоритетов и диагностика. Не переключает PCM-поток и не активирует микрофон.</p></header>
  <div className="rounded-xl border border-current/15 p-3 space-y-1">
   <p className="text-sm font-semibold">Расчётный источник: {data.decision?.source||'—'}</p>
   <p className="text-xs opacity-65">{data.decision?.reason}</p>
   <p className="text-xs opacity-65">Подключение прямого звука: не реализовано · Фактическое переключение: выключено</p>
  </div>
  <div className="grid sm:grid-cols-2 gap-3">
   <label className="text-sm space-y-1">Желаемый источник
    <select className="w-full rounded-lg border border-current/20 bg-transparent p-2" value={settings.requestedSource}
     onChange={e=>setData(v=>({...v,settings:{...v.settings,requestedSource:e.target.value}}))}>
     <option value="AUTO_DJ">Авто-DJ</option><option value="LIVE">Ведущий (планируется)</option>
    </select></label>
   <label className="text-sm space-y-1">Таймаут потери связи, секунд
    <input type="number" min="5" max="60" className="w-full rounded-lg border border-current/20 bg-transparent p-2"
     value={settings.heartbeatTimeoutSec} onChange={e=>setData(v=>({...v,settings:{...v.settings,heartbeatTimeoutSec:Number(e.target.value)}}))}/></label>
  </div>
  <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={settings.liveEnabled}
   onChange={e=>setData(v=>({...v,settings:{...v.settings,liveEnabled:e.target.checked}}))}/>Разрешить источник ведущего в будущей политике</label>
  <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={settings.autoReturn}
   onChange={e=>setData(v=>({...v,settings:{...v.settings,autoReturn:e.target.checked}}))}/>Автоматически возвращаться к Авто-DJ при потере связи</label>
  <div className="flex gap-2 flex-wrap"><button disabled={saving} onClick={save} className="rounded-xl bg-blue-600 px-4 py-2 text-white text-sm disabled:opacity-50">Сохранить политику</button>
   <button onClick={load} className="rounded-xl border border-current/20 px-4 py-2 text-sm">Обновить статус</button></div>
  <div className="rounded-xl border border-current/15 p-3 space-y-2 text-sm">
   <div className="flex flex-wrap gap-2 items-center justify-between"><h3 className="font-semibold">Предпросмотр переключения источников</h3>
    <button type="button" className="rounded-lg border border-current/20 px-3 py-2 text-xs" onClick={async()=>{
     try{setHandover((await api('/radio/source-handover/preview',{token})).plan);setError('');}catch(e){setError(e.message);}
    }}>Проверить сценарий</button></div>
   {handover&&<div className="space-y-1 text-xs">
    <p>Расчётный источник: <strong>{handover.target}</strong> · {handover.reason}</p>
    <p>Действие: {handover.transition} · Соединение ведушего: {handover.connectionFresh?'есть':'нет'} · PCM: {handover.pcmSamplesReceived?'подтверждён':'не подключён'}</p>
    {handover.timeToScheduleMs!==null&&<p>До ближайшей передачи: {Math.ceil(handover.timeToScheduleMs/1000)} сек.</p>}
    <p className="opacity-60">Это модель переключения. Передача микрофона в серверный поток не активирована.</p>
   </div>}
  </div>
  {error&&<p role="alert" className="text-red-500 text-sm">{error}</p>}
  {note&&<p role="status" className="text-emerald-500 text-sm">{note}</p>}
 </section>;
}
