import {useEffect,useState} from 'react';
import {api} from '../../../api/client.js';
import MchsWorkerServerSession from './MchsWorkerServerSession.jsx';

export default function MchsEmergencySimulation({token}){
 const [status,setStatus]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const refresh=async()=>{
  try{setStatus(await api('/safety/mchs-training-stream',{token}));setError('');}
  catch(e){setError(e.message||'Нет связи с Radio Worker');}
 };
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},3000);return()=>clearInterval(timer);},[token]);
 const command=async action=>{
  if(action==='START'&&!window.confirm('Запустить учебное сообщение в ОСНОВНОМ радиопотоке? Звук получат интернет-слушатели и подключённые громкоговорители. Подтвердите, что аудитория предупреждена, запись явно учебная, громкость безопасная и доступна физическая остановка усилителя.'))return;
  setBusy(true);setError('');
  try{setStatus(await api('/safety/mchs-training-stream',{token,method:'POST',body:{action}}));}
  catch(e){setError(e.message||'Команда не выполнена');}
  finally{setBusy(false);}
 };
 return <section className="mchs-panel rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-4 sm:p-5 space-y-4">
  <div className="space-y-1">
   <h3 className="text-lg font-semibold">Учебное переключение основного радиопотока</h3>
   <p className="text-sm text-slate-600 dark:text-slate-300">Отдельный режим: учебная запись заменяет PCM перед общим MP3-кодировщиком. Она может быть слышна и на сайте, и через Windows Agent. Автоматические тревоги МЧС не задействованы.</p>
  </div>
  <div className="rounded-xl border border-amber-300/50 p-3 space-y-3">
   <p className="text-sm font-medium">Основной поток: {status?.active?'Учебная запись':'Обычная программа'} · {status?.enabled?'Режим включён на сервере':'Режим выключен на сервере'}</p>
   <p className="text-xs text-slate-600 dark:text-slate-300">Не более 10 секунд. Перед проверкой загрузите на сервер учебную запись PCM 48 кГц / stereo / s16le и включите отдельный флаг. Ни START, ни STOP не управляют ESP32 или усилителем.</p>
   <div className="flex flex-wrap gap-2">
    <button type="button" disabled={busy||!status?.enabled||status?.active} onClick={()=>void command('START')} className="rounded-lg bg-amber-600 px-3 py-2 text-white disabled:opacity-40">Включить учебную запись в эфир</button>
    <button type="button" disabled={busy} onClick={()=>void command('STOP')} className="rounded-lg bg-red-700 px-3 py-2 text-white disabled:opacity-50">СТОП / вернуть программу</button>
    <button type="button" onClick={()=>void refresh()} className="rounded-lg border px-3 py-2">Обновить</button>
   </div>
   {error&&<p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
  </div>
  <details className="rounded-xl border border-slate-200 dark:border-white/15 p-3">
   <summary className="cursor-pointer font-medium">Изолированная лабораторная сессия (архивные тесты)</summary>
   <div className="mt-3"><MchsWorkerServerSession token={token}/></div>
  </details>
 </section>;
}
