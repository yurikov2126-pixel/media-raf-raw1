import MchsWorkerFixtureStage from './MchsWorkerFixtureStage.jsx';
import MchsWorkerLivePcmMonitor from './MchsWorkerLivePcmMonitor.jsx';
import MchsWorkerSessionMonitor from './MchsWorkerSessionMonitor.jsx';
import {useCallback,useEffect,useState} from 'react';
export default function MchsWorkerServerSession({token}){
 const [status,setStatus]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const root=import.meta.env.VITE_API||'http://localhost:4000/api';
 const get=useCallback(async()=>{
  const res=await fetch(root+'/safety/worker-lab/session',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  if(!res.ok)throw new Error('Не удалось прочитать сессию: '+res.status);
  setStatus(await res.json());
 },[root,token]);
 useEffect(()=>{void get().catch(e=>setError(e.message));},[get]);
 const command=async action=>{
  setBusy(true);setError('');
  try{
   const res=await fetch(root+'/safety/worker-lab/session',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action}),cache:'no-store'});
   const data=await res.json();
   if(!res.ok)throw new Error(data.reason||data.error||'Команда отклонена');
   setStatus(data);
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 };
 return <div className="rounded-xl border border-slate-300 dark:border-white/20 p-4 space-y-3">
  <h4 className="font-semibold">Учебное переключение Windows Agent</h4>
  <p className="text-sm text-slate-600 dark:text-slate-300">Управление учебной сессией Worker для уже настроенного Windows Agent. При испытании AA-300 может быть включён вручную, но его аудиовход должен оставаться физически отсоединённым от радиокомпьютера и других источников. Это не проверка громкоговорителей.</p>
  <p role="status" className="text-sm">Состояние Worker: {status?.phase||'неизвестно'} · Ревизия: {status?.revision??'—'}</p>
  <div className="flex flex-wrap gap-2">
   <button disabled={busy||status?.phase!=='IDLE'} onClick={()=>void command('START')} className="rounded-lg bg-violet-600 px-3 py-2 text-white text-sm disabled:opacity-40">Запустить программу</button>
   <button disabled={busy||status?.phase!=='PROGRAM'} onClick={()=>void command('INTERRUPT')} className="rounded-lg bg-amber-600 px-3 py-2 text-white text-sm disabled:opacity-40">Учебное оповещение</button>
   <button disabled={busy||status?.phase!=='ALERT'} onClick={()=>void command('RESUME')} className="rounded-lg bg-emerald-700 px-3 py-2 text-white text-sm disabled:opacity-40">Вернуть радио</button>
   <button disabled={busy} onClick={()=>void command('STOP')} className="rounded-lg border border-red-500 px-3 py-2 text-sm">Остановить сессию</button>
   <button disabled={busy} onClick={()=>void get().catch(e=>setError(e.message))} className="rounded-lg border px-3 py-2 text-sm">Обновить статус</button>
  </div>
  {error&&<p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
  <p className="text-xs text-slate-600 dark:text-slate-300">Реакция Worker на команду до первого PCM-тика: {status?.pcmObservation && status.pcmObservation.revision===status.revision ? status.pcmObservation.workerCommandToPcmTickMs+' мс':'не измерена — обновите статус после команды при запущенном потоке'}. Это только серверная задержка, не время появления звука в наушниках.</p>
  <details className="rounded-lg border border-slate-200 dark:border-white/15 p-3"><summary className="cursor-pointer text-sm font-medium">Дополнительные инструменты лаборатории</summary><div className="mt-3 space-y-3"><MchsWorkerFixtureStage token={token}/><MchsWorkerSessionMonitor token={token} phase={status?.phase} revision={status?.revision}/><MchsWorkerLivePcmMonitor token={token} phase={status?.phase} revision={status?.revision}/></div></details>
  <p className="text-xs">Сессия автоматически истекает через 120 секунд без команд. STOP не влияет на настоящее радио.</p>
 </div>;
}