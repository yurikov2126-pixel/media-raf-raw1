import {useCallback,useEffect,useState} from 'react';
import {api} from '../../../api/client.js';
const labels={AUTO_DJ:'AutoDJ',SCHEDULE:'Эфирная сетка',LIVE:'Прямой эфир',MANUAL_PLAYLIST:'Ручной плейлист',AUTO_PLAYLIST:'Автоматический плейлист'};
const steps={PREPARE:'Подготовка',ACTIVATE:'Моделирование запуска',STOP:'Моделирование остановки',RECOVER:'План восстановления',RESET:'Завершение'};
export default function MchsEmergencySimulation({token}){
 const [result,setResult]=useState(null);
 const [source,setSource]=useState('');
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{setResult(await api('/safety/emergency-simulation'+(source?'?source='+encodeURIComponent(source):''),{token}));}
  catch(e){setError(e.message||'Не удалось выполнить сценарий');setResult(null);}
  finally{setLoading(false);}
 },[token,source]);
 useEffect(()=>{void load();},[load]);
 const scenarios=result?.scenarios|| (result?.source?[result]:[]);
 return <section className="mchs-panel rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-4 sm:p-5 space-y-4">
  <div><h3 className="text-lg font-semibold">Симулятор экстренного переключения</h3>
    <p className="text-sm text-slate-600 dark:text-slate-300">Только диагностическая модель. Команды не поступают в Radio Worker, звуковой тракт или управление усилителем.</p></div>
  <div className="flex flex-wrap gap-2 items-center">
    <select aria-label="Источник вещания для симуляции" value={source} onChange={e=>setSource(e.target.value)}
      className="rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
      <option value="">Все источники</option>
      {Object.entries(labels).map(([key,title])=><option key={key} value={key}>{title}</option>)}
    </select>
    <button type="button" disabled={loading} onClick={()=>void load()} className="rounded-xl bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-50">{loading?'Проверка…':'Повторить симуляцию'}</button>
  </div>
  {error&&<p role="alert" className="text-red-700 dark:text-red-300 text-sm">{error}</p>}
  <div className="grid md:grid-cols-2 gap-3">
    {scenarios.map(s=><article key={s.source} className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-2">
      <div className="flex flex-wrap justify-between gap-2"><strong>{labels[s.source]||s.source}</strong><span className="text-sm">{s.ok?'Сценарий пройден':'Ошибка сценария'}</span></div>
      <p className="text-xs text-slate-600 dark:text-slate-300">Финальное состояние: {s.finalState}. Реальный эфир не менялся.</p>
      <ol className="space-y-1 text-sm">{s.steps?.map((step,i)=><li key={i} className="rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5">
        {steps[step.action]||step.action} · {step.accepted?'Допустимо':'Отклонено'} · {step.reason}
      </li>)}</ol>
    </article>)}
  </div>
  <p className="text-xs text-slate-600 dark:text-slate-300">Симуляция проверяет логику состояний и ограничений, но не подтверждает готовность реального аварийного звука. Автоматическое вещание МЧС по-прежнему заблокировано.</p>
 </section>;
}
