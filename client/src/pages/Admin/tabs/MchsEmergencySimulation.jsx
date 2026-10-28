import {useCallback,useEffect,useState} from 'react';
import {api} from '../../../api/client.js';
const labels={AUTO_DJ:'AutoDJ',SCHEDULE:'Эфирная сетка',LIVE:'Прямой эфир',MANUAL_PLAYLIST:'Ручной плейлист',AUTO_PLAYLIST:'Автоматический плейлист'};
const steps={PREPARE:'Подготовка',ACTIVATE:'Моделирование запуска',STOP:'Моделирование остановки',RECOVER:'План восстановления',RESET:'Завершение'};
export default function MchsEmergencySimulation({token}){
 const [result,setResult]=useState(null);
 const [source,setSource]=useState('');
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [selected,setSelected]=useState(null);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{setResult(await api('/safety/emergency-simulation'+(source?'?source='+encodeURIComponent(source):''),{token}));}
  catch(e){setError(e.message||'Не удалось выполнить сценарий');setResult(null);}
  finally{setLoading(false);}
 },[token,source]);
 useEffect(()=>{void load();},[load]);
 const scenarios=result?.scenarios|| (result?.source?[result]:[]);
 const active=scenarios.find(s=>s.source===selected);
 useEffect(()=>{if(!active)return;const handle=e=>{if(e.key==='Escape')setSelected(null);};window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);},[active]);
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
  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/15">
    <table className="w-full text-sm text-left">
      <thead className="bg-slate-50 dark:bg-white/5"><tr><th className="p-3">Источник</th><th className="p-3">Программная модель</th><th className="p-3">Реальный аудиотракт</th><th className="p-3">Действие</th></tr></thead>
      <tbody>{scenarios.map(s=><tr key={s.source} className="border-t border-slate-200 dark:border-white/10">
        <td className="p-3 font-medium">{labels[s.source]||s.source}</td>
        <td className="p-3">{s.ok?'Пройдена':'Ошибка'}</td>
        <td className="p-3 text-slate-600 dark:text-slate-300">Не проверялся</td>
        <td className="p-3"><button type="button" onClick={()=>setSelected(s.source)} className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2">Подробнее</button></td>
      </tr>)}</tbody>
    </table>
  </div>
  {active&&<div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6" role="presentation">
    <button type="button" aria-label="Закрыть подробности" onClick={()=>setSelected(null)} className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" />
    <section role="dialog" aria-modal="true" aria-labelledby="mchs-sim-dialog-title" className="relative w-full max-w-2xl max-h-[85dvh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 space-y-3">
      <div className="flex justify-between gap-3"><h4 id="mchs-sim-dialog-title" className="font-semibold text-lg">{labels[active.source]}</h4><button type="button" onClick={()=>setSelected(null)} aria-label="Закрыть" className="rounded-lg border px-3 py-1.5">Закрыть</button></div>
      <p className="text-sm">Программная модель: {active.ok?'успешно':'неуспешно'}. Физическая цепочка и состояние реального источника не проверялись.</p>
      <p className="text-sm"><strong>План восстановления:</strong> {active.recoveryPlan||'Нет данных'}. Это только описание предполагаемого поведения.</p>
      <ol className="space-y-2 text-sm">{active.steps?.map((step,i)=><li key={i} className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2">{steps[step.action]||step.action}: {step.accepted?'допустимо':'отклонено'}. {({READY:'Готово к моделированию',ACTIVATION_PLAN_ONLY:'Смоделирован план запуска',STOP_REQUESTED:'Смоделирована команда остановки',RECOVERY_REQUESTED:'Смоделирован план возврата',RESET_COMPLETE:'Проверка завершена'})[step.reason]||step.reason}</li>)}</ol>
    </section>
  </div>}
  <p className="text-xs text-slate-600 dark:text-slate-300">Симуляция проверяет логику состояний и ограничений, но не подтверждает готовность реального аварийного звука. Автоматическое вещание МЧС по-прежнему заблокировано.</p>
 </section>;
}
