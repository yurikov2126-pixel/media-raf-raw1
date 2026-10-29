import {useCallback,useEffect,useState} from 'react';
import {api} from '../../../api/client.js';
import MchsWorkerServerSession from './MchsWorkerServerSession.jsx';
const labels={AUTO_DJ:'AutoDJ',SCHEDULE:'Эфирная сетка',LIVE:'Прямой эфир',MANUAL_PLAYLIST:'Ручной плейлист',AUTO_PLAYLIST:'Автоматический плейлист'};
const steps={PREPARE:'Подготовка',ACTIVATE:'Моделирование запуска',STOP:'Моделирование остановки',RECOVER:'План восстановления',RESET:'Завершение'};
export default function MchsEmergencySimulation({token}){
 const [result,setResult]=useState(null);
 const [source,setSource]=useState('');
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [worker,setWorker]=useState(null);
 const [audioReadiness,setAudioReadiness]=useState(null);
 const [audioReadinessError,setAudioReadinessError]=useState('');
 const [resume,setResume]=useState(null);
 const [resumeError,setResumeError]=useState('');
 const [workerLoading,setWorkerLoading]=useState(false);
 const [selected,setSelected]=useState(null);
 const [agentObservation,setAgentObservation]=useState(null);
 const [agentObservationError,setAgentObservationError]=useState('');
 const refreshAgentObservation=useCallback(async()=>{
  try{setAgentObservationError('');setAgentObservation(await api('/radio-agent/mchs-observer-status',{token}));}
  catch(e){setAgentObservation(null);setAgentObservationError(e.message||'Нет связи с диагностикой Agent');}
 },[token]);
 useEffect(()=>{void refreshAgentObservation();},[refreshAgentObservation]);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{setResult(await api('/safety/emergency-simulation'+(source?'?source='+encodeURIComponent(source):''),{token}));}
  catch(e){setError(e.message||'Не удалось выполнить сценарий');setResult(null);}
  finally{setLoading(false);}
 },[token,source]);
 useEffect(()=>{void load();},[load]);
 const refreshWorker=useCallback(async()=>{
  setWorkerLoading(true);
  try{setWorker(await api('/safety/radio-worker-readiness',{token}));}
  catch(e){setWorker({reachable:false,reason:e.message||'Нет данных о Radio Worker'});}
  finally{setWorkerLoading(false);}
 },[token]);
 useEffect(()=>{void refreshWorker();},[refreshWorker]);
 const refreshResume=useCallback(async()=>{try{setResumeError('');setResume(await api('/safety/radio-resume-diagnostic',{token}));}catch(e){setResume(null);setResumeError(e.message||'Не удалось получить план');}},[token]);
 useEffect(()=>{void refreshResume();},[refreshResume]);
 const refreshAudioReadiness=useCallback(async()=>{
  try{setAudioReadinessError('');setAudioReadiness(await api('/safety/audio-test-readiness',{token}));}
  catch(e){setAudioReadiness(null);setAudioReadinessError(e.message||'Проверка готовности недоступна');}
 },[token]);
 useEffect(()=>{void refreshAudioReadiness();},[refreshAudioReadiness]);
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
  <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-3">
    <div className="flex flex-wrap gap-2 justify-between items-center">
      <h4 className="font-semibold">Состояние реального Radio Worker — только чтение</h4>
      <button type="button" onClick={()=>void refreshWorker()} disabled={workerLoading} className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2 text-sm disabled:opacity-50">{workerLoading?'Обновление…':'Обновить состояние'}</button>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
      {[
        ['Доступность',worker?.reachable===true?'Worker отвечает':worker?.reachable===false?'Нет ответа':'Нет данных'],
        ['Текущий источник',worker?.source||'Неизвестен'],
        ['Трек',worker?.trackId||'Нет данных'],
        ['Слот расписания',worker?.slotId||'Нет данных'],
        ['Следующий трек',worker?.nextTrackId||'Нет данных'],
        ['Последняя ошибка',worker?.lastError||'Не сообщалась']
      ].map(([label,value])=><div key={label} className="rounded-lg bg-slate-50 dark:bg-white/5 p-3 min-w-0">
        <p className="text-xs text-slate-600 dark:text-slate-300">{label}</p>
        <p className="font-medium mt-1 break-all">{value}</p>
      </div>)}
    </div>
    <p className="text-xs text-slate-600 dark:text-slate-300">Проверка восстановления программы: не выполнялась. Реальный звук и усилитель: не проверялись. Ответ Worker не доказывает готовность к экстренному переключению. Действующий эфир не меняется.</p>
  </div>
  <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">План возврата по актуальной сетке</h4><button type="button" onClick={()=>void refreshResume()} className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2 text-sm">Пересчитать</button></div>
    {resumeError&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{resumeError}</p>}
    {resume&&<div className="grid sm:grid-cols-2 gap-2 text-sm">
      {[
        ['Текущий источник',resume.currentSource],
        ['Время расчёта',new Date(resume.checkedAt).toLocaleString('ru-RU')],
        ['Предложенное действие',resume.plan?.action||'Нет'],
        ['Причина',resume.plan?.reason||'Нет данных'],
        ['Слот',resume.plan?.slotId||'Нет подтверждения'],
        ['Трек',resume.plan?.trackId||'Нет подтверждения']
      ].map(([name,value])=><div key={name} className="rounded-lg bg-slate-50 dark:bg-white/5 p-3"><span className="block text-xs text-slate-600 dark:text-slate-300">{name}</span><strong className="block mt-1 break-all">{value}</strong></div>)}
    </div>}
    <p className="text-xs text-slate-600 dark:text-slate-300">Расчёт использует действующее расписание и снимок Radio Worker. Доступность студии, полномочия плейлистов и реальное восстановление звука не подтверждены. Никакого переключения не выполняется.</p>
  </div>
  <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-3">
    <div className="flex flex-wrap justify-between items-center gap-2">
      <h4 className="font-semibold">Допуск к испытаниям на реальном звуке</h4>
      <button type="button" onClick={()=>void refreshAudioReadiness()} className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2 text-sm">Проверить условия</button>
    </div>
    <p className="text-sm font-medium">{audioReadiness?.readyForIsolatedAudioTest===true?'Все диагностические условия отмечены':'Пока не готово к изолированному аудиотесту'}</p>
    {audioReadinessError&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{audioReadinessError}</p>}
    <div className="grid sm:grid-cols-2 gap-2">
      {(audioReadiness?.checks||[]).map(check=><div key={check.id} className="rounded-lg border border-slate-200 dark:border-white/15 p-3">
        <span className="text-xs font-medium">{check.passed?'Подтверждено':'Не подтверждено'}</span>
        <p className="text-sm mt-1">{check.description}</p>
      </div>)}
    </div>
    <p className="text-xs text-slate-600 dark:text-slate-300">Неотмеченные условия нельзя подтвердить кнопкой в интерфейсе. Сначала необходимы независимая проверка звукового файла, изоляции выходов, аварийной остановки, восстановления и присутствия ответственного. Этот экран не запускает звук.</p>
  </div>
  <div className="rounded-xl border border-violet-300/50 dark:border-violet-400/25 p-3 space-y-2">
    <h4 className="font-semibold">Интеграционная диагностика Windows Agent</h4>
    <p className="text-sm">Основной Windows Radio Agent продолжает штатное воспроизведение. При разрешённом серверном наблюдении он регистрирует ревизии учебной сессии и пишет MCHS_AGENT_OBSERVER в журнал. Учебный звук в основной выход не подаётся.</p>
    <p className="text-xs text-slate-600 dark:text-slate-300">Устаревшие браузерные WAV и отдельные микшеры убраны. OBSERVE_ONLY — наблюдение, а не тест реального прерывания звука.</p>
  </div>
  <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-2">
    <div className="flex items-center justify-between gap-2">
      <h4 className="font-semibold">Windows Agent — наблюдение в реальном времени</h4>
      <button type="button" onClick={()=>void refreshAgentObservation()} className="rounded-lg border px-3 py-2 text-sm">Обновить</button>
    </div>
    <p className="text-sm">Статус телеметрии: {agentObservation?.status||'нет данных'}</p>
    {agentObservation?.report&&<div className="text-sm space-y-1">
      <p>Состояние лаборатории: {agentObservation.report.workerPhase} · ревизия {agentObservation.report.revision}</p>
      <p>Готовность Agent: {agentObservation.report.code}</p>
      {agentObservation.report.transition&&<p>Переход: {agentObservation.report.transition.transitionState} · пропущено ревизий: {agentObservation.report.transition.missedRevisions}</p>}
      <p>Основной процесс: {agentObservation.report.primaryAlive?'запущен':'не подтверждён'} · резерв: {agentObservation.report.reserveAlive?'запущен':'не запущен'}</p>
      <p className="text-xs text-slate-600 dark:text-slate-300">Наблюдение получено: {agentObservation.report.receivedAt}. Физическое прерывание звука и PA не проверены.</p>
    </div>}
    {agentObservationError&&<p role="alert" className="text-sm text-red-600">{agentObservationError}</p>}
    <p className="text-xs text-slate-600 dark:text-slate-300">Если данные устарели или доступ отключён, статус не считается подтверждённым. Эта панель не управляет вещанием.</p>
  </div>
  <MchsWorkerServerSession token={token}/>
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
