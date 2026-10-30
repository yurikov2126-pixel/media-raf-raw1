import {useCallback,useEffect,useState} from 'react';
import {api} from '../../../api/client.js';
import MchsWorkerServerSession from './MchsWorkerServerSession.jsx';

/** Operator-led isolated audio trial, not a public-address activation page. */
export default function MchsEmergencySimulation({token}){
 const [report,setReport]=useState(null),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  try{setReport(await api('/radio-agent/mchs-observer-status',{token}));setError('');}
  catch(e){setReport(null);setError(e.message||'Нет связи с Windows Agent');}
 },[token]);
 useEffect(()=>{
  void refresh();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},5000);
  return ()=>clearInterval(timer);
 },[refresh]);
 return <section className="mchs-panel rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-4 sm:p-5 space-y-4">
  <header className="space-y-2">
   <h3 className="text-lg font-semibold">Испытание звукового переключения МЧС</h3>
   <p className="text-sm text-slate-600 dark:text-slate-300">Испытание через существующий Windows Radio Agent. Усилитель AA-300 допускается включить вручную только при физически отключённом звуковом входе и отсутствии других путей звука в громкоговорители. Этот экран не управляет питанием усилителя или ESP32.</p>
  </header>
  <div className="rounded-xl border border-amber-400/60 p-3 space-y-2">
   <h4 className="font-semibold text-sm">Перед началом</h4>
   <p className="text-sm">Проверьте отсутствие всех звуковых соединений с AA-300. Убедитесь, что Windows Agent работает, затем локально разрешите в нём одно учебное событие. Оператор должен находиться рядом с оборудованием и иметь возможность немедленно прекратить тест.</p>
   <p className="text-xs text-slate-600 dark:text-slate-300">Автоматическая подача реальной тревоги и испытание громкоговорителей этим режимом не выполняются. Не используйте реальные тревожные сигналы.</p>
  </div>
  <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-2">
   <div className="flex items-center justify-between gap-2"><h4 className="font-semibold">Windows Agent</h4><button type="button" onClick={()=>void refresh()} className="rounded-lg border px-3 py-2 text-sm">Обновить</button></div>
   <p className="text-sm">Телеметрия: {report?.status||'нет данных'}</p>
   {report?.report&&<p className="text-sm">Worker: {report.report.workerPhase||'неизвестно'} · ревизия {report.report.revision??'—'} · Agent: {report.report.code||'нет данных'}</p>}
   {error&&<p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
   <p className="text-xs text-slate-600 dark:text-slate-300">Это удалённое наблюдение, а не подтверждение физической изоляции кабеля.</p>
  </div>
  <MchsWorkerServerSession token={token}/>
 </section>;
}
