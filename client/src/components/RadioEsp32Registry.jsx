import {useCallback,useEffect,useState} from 'react';
import {api} from '../api/client.js';

const field='w-full rounded-xl border border-current/20 bg-white/90 px-3 py-2.5 text-sm text-slate-900 outline-offset-2 focus-visible:outline-indigo-500 dark:bg-slate-950/80 dark:text-slate-100';

export default function RadioEsp32Registry({token}){
 const [devices,setDevices]=useState([]);
 const [name,setName]=useState('ESP32 · Усилитель');
 const [ip,setIp]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const refresh=useCallback(async()=>{
  try {
   const data=await api('/radio-agent/esp32',{token});
   setDevices(data.devices||[]);setError('');
  }catch(e){setError(e.message||'Не удалось загрузить устройства');}
  finally{setLoading(false);}
 },[token]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>{void refresh();},6500);return ()=>clearInterval(timer);},[refresh]);
 const add=async event=>{
  event.preventDefault();
  if(busy)return;
  setBusy(true);setError('');setMessage('');
  try{
   await api('/radio-agent/esp32',{token,method:'POST',body:{name:name.trim(),ip:ip.trim(),gpio:13}});
   setIp('');setMessage('ESP32 зарегистрирован. Управление усилителем не активировано.');
   await refresh();
  }catch(e){setError(e.message||'Не удалось зарегистрировать ESP32');}
  finally{setBusy(false);}
 };
 const remove=async device=>{
  if(!window.confirm('Удалить ESP32 «'+device.name+'» из списка оборудования? Это не изменяет состояние реле.'))return;
  setBusy(true);setError('');setMessage('');
  try{
   await api('/radio-agent/esp32/'+encodeURIComponent(device.id),{token,method:'DELETE'});
   setMessage('ESP32 удалён из списка.');await refresh();
  }catch(e){setError(e.message||'Не удалось удалить ESP32');}
  finally{setBusy(false);}
 };
 return <section className="space-y-4 rounded-2xl border border-current/10 bg-white/70 p-4 text-slate-900 dark:bg-slate-900/60 dark:text-slate-100 sm:p-5">
  <div>
   <h3 className="text-lg font-bold">ESP32 · Управление усилителем</h3>
   <p className="mt-1 text-sm opacity-70">Реестр контроллеров Wi-Fi. GPIO 13 · реле 5 В. На этом этапе только регистрация — включение питания 220 В программно заблокировано.</p>
  </div>
  <form onSubmit={add} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
   <label className="space-y-1 text-sm font-medium">Название контроллера
    <input className={field} value={name} onChange={e=>setName(e.target.value)} maxLength={80} placeholder="ESP32 · Усилитель" required/>
   </label>
   <label className="space-y-1 text-sm font-medium">Локальный IP ESP32
    <input className={field} value={ip} onChange={e=>setIp(e.target.value)} inputMode="decimal" autoComplete="off" placeholder="192.168.1.50" required/>
   </label>
   <button type="submit" disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">+ Добавить ESP32</button>
  </form>
  {error&&<p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}
  {message&&<p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
  <div className="flex items-center justify-between gap-3">
   <p className="text-xs opacity-65">Зарегистрировано: {devices.length} · Сеть: Studio</p>
   <button type="button" className="rounded-lg border border-current/20 px-3 py-2 text-xs" onClick={refresh}>Обновить</button>
  </div>
  {loading?<p className="text-sm opacity-70">Загрузка контроллеров…</p>:devices.length===0?<p className="rounded-xl border border-dashed border-current/15 p-4 text-sm opacity-70">Пока нет зарегистрированных ESP32. Укажи IP контроллера в локальной сети.</p>:
   <div className="space-y-2">{devices.map(d=><div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-current/10 bg-white/80 p-3 dark:bg-slate-800/80">
    <div className="min-w-0 space-y-1">
     <p className="font-semibold">{d.name}</p>
     <p className="break-all text-xs opacity-75">Wi-Fi · {d.ip} · GPIO {d.gpio}</p>
     <p className={d.connectivity==='ONLINE'?'text-xs text-emerald-700 dark:text-emerald-300':'text-xs text-amber-700 dark:text-amber-300'}>{d.connectivity==='ONLINE'?'● На связи':'○ Нет свежей телеметрии'} · Реле заблокировано</p>
     {d.telemetry&&<p className="text-xs opacity-75">Эфир: {d.telemetry.agentMode} · Heartbeat: {d.telemetry.heartbeatCount} · Разрешение: {d.telemetry.leaseValid?'действует':'нет'} · Обновлено: {new Date(d.telemetry.observedAt).toLocaleTimeString('ru-RU')}</p>}
    </div>
    <button type="button" disabled={busy} onClick={()=>remove(d)} className="rounded-lg border border-rose-500/30 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50 dark:text-rose-300">Удалить</button>
   </div>)}</div>}
  <p className="text-xs opacity-60">Пароль сети и секрет связи с Windows Agent здесь не хранятся. ESP32 должен быть прошит безопасной тестовой прошивкой без подключения сетевой нагрузки.</p>
 </section>;
}
