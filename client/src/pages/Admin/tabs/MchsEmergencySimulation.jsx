import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from '../../../api/client.js';
import MchsIsolatedMixer from './MchsIsolatedMixer.jsx';
import MchsFileAudioTest from './MchsFileAudioTest.jsx';
import MchsWorkerInteractiveLab from './MchsWorkerInteractiveLab.jsx';
const labels={AUTO_DJ:'AutoDJ',SCHEDULE:'Эфирная сетка',LIVE:'Прямой эфир',MANUAL_PLAYLIST:'Ручной плейлист',AUTO_PLAYLIST:'Автоматический плейлист'};
const steps={PREPARE:'Подготовка',ACTIVATE:'Моделирование запуска',STOP:'Моделирование остановки',RECOVER:'План восстановления',RESET:'Завершение'};
export default function MchsEmergencySimulation({token}){
 const [result,setResult]=useState(null);
 const [source,setSource]=useState('');
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [worker,setWorker]=useState(null);
 const [audioReadiness,setAudioReadiness]=useState(null);
 const previewRef=useRef(null);
 const [previewStatus,setPreviewStatus]=useState('IDLE');
 const [previewError,setPreviewError]=useState('');
 const [workerLabScenario,setWorkerLabScenario]=useState('resume');
 const [audioReadinessError,setAudioReadinessError]=useState('');
 const [resume,setResume]=useState(null);
 const [resumeError,setResumeError]=useState('');
 const [workerLoading,setWorkerLoading]=useState(false);
 const [selected,setSelected]=useState(null);
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
 const stopPreview=useCallback(()=>{
  const current=previewRef.current;
  if(current){current.audio.pause();current.audio.currentTime=0;URL.revokeObjectURL(current.url);previewRef.current=null;}
  setPreviewStatus('STOPPED');
 },[]);
 useEffect(()=>()=>{const current=previewRef.current;if(current){current.audio.pause();URL.revokeObjectURL(current.url);previewRef.current=null;}},[]);
 const playPreview=useCallback(async(kind='tone')=>{
  stopPreview();setPreviewError('');setPreviewStatus('LOADING');
  try{
   const apiRoot=import.meta.env.VITE_API||'http://localhost:4000/api';
   const response=await fetch(apiRoot+(kind==='worker'?'/safety/worker-lab/handover.wav?scenario='+encodeURIComponent(workerLabScenario):kind==='handover'?'/safety/isolated-handover.wav':'/safety/isolated-test-tone.wav'),{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
   if(!response.ok){
    const diagnostic=await response.json().catch(()=>null);
    const messages={
     WORKER_NOT_CONFIGURED:'API не настроен для соединения с Radio Worker: проверьте порт и секрет в окружении API.',
     WORKER_AUTH_FAILED:'Radio Worker отклонил секрет API. Проверьте совпадение RADIO_PLAYOUT_SECRET в обоих сервисах.',
     WORKER_ROUTE_MISSING:'Radio Worker отвечает, но тестовый маршрут отсутствует. Проверьте перезапуск Worker после обновления.',
     WORKER_TIMEOUT:'Radio Worker не ответил вовремя. Проверьте состояние сервиса и его журнал.',
     WORKER_UNREACHABLE:'API не может подключиться к Radio Worker. Проверьте работу сервиса и локальный порт.',
     WORKER_INVALID_AUDIO:'Radio Worker вернул некорректный или слишком большой WAV.',
     WORKER_REQUEST_FAILED:'Ошибка запроса к Radio Worker. Проверьте журналы API и Worker.'
    };
    const code=diagnostic?.code;
    throw new Error((code&&messages[code])||('Сервер не выдал тестовый звук ('+response.status+')'));
   }
   const blob=await response.blob();
   if(blob.size>800000)throw new Error('Тестовый файл превышает допустимый размер');
   const url=URL.createObjectURL(blob),audio=new Audio(url);
   previewRef.current={audio,url};
   audio.onended=()=>{if(previewRef.current?.audio===audio)stopPreview();};
   audio.onerror=()=>{if(previewRef.current?.audio===audio){stopPreview();setPreviewError('Браузер не смог воспроизвести WAV');}};
   await audio.play();
   setPreviewStatus('PLAYING');
  }catch(e){stopPreview();setPreviewError(e.message||'Невозможно запустить тестовый сигнал');}
 },[token,stopPreview,workerLabScenario]);
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
  <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-3">
    <h4 className="font-semibold">Первый тест реального звука — только на этом устройстве</h4>
    <p className="text-sm text-slate-600 dark:text-slate-300">Короткий оригинальный четырёхтональный сигнал WAV. Звук будет воспроизводиться локально в этом браузере через выбранное на устройстве аудиоустройство. Перед запуском проверьте громкость и физически отключите выход к усилителю колледжа.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={previewStatus==='LOADING'} onClick={()=>void playPreview('tone')} className="rounded-lg bg-violet-600 text-white px-4 py-2 text-sm disabled:opacity-50">{previewStatus==='LOADING'?'Загрузка…':'Воспроизвести тестовый сигнал'}</button>
      <button type="button" onClick={stopPreview} className="rounded-lg border border-slate-300 dark:border-white/20 px-4 py-2 text-sm">Остановить</button>
    </div>
    <div className="rounded-lg border border-slate-200 dark:border-white/15 p-3 space-y-2">
      <strong className="text-sm">Изолированная демонстрация перехода «музыка → сигнал → музыка»</strong>
      <p className="text-xs text-slate-600 dark:text-slate-300">Шесть секунд синтезированного аудио: 0–2 с фоновый тон, 2–4 с сигнал прерывания, 4–6 с возобновление фона. Это заранее подготовленный WAV, а не переключение настоящего Radio Worker.</p>
      <button type="button" disabled={previewStatus==='LOADING'} onClick={()=>void playPreview('handover')} className="rounded-lg bg-violet-600 text-white px-3 py-2 text-sm disabled:opacity-50">Прослушать тест перехода</button>
    </div>
    <p className="text-xs">Состояние: {({IDLE:'не запускался',LOADING:'загрузка',PLAYING:'локальное воспроизведение',STOPPED:'остановлен'})[previewStatus]}</p>
    {previewError&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{previewError}</p>}
    <p className="text-xs text-slate-600 dark:text-slate-300">Это не голосовое сообщение МЧС и не проверка прерывания эфира. Не подключено к Radio Worker, интернет-радио или ESP32. Если браузер использует общий системный выход с усилителем, не запускайте тест до физического отключения усилителя.</p>
  </div>
  <MchsIsolatedMixer token={token} stopOtherPreview={stopPreview}/>
  <div className="rounded-xl border border-slate-200 dark:border-white/15 p-4 space-y-3">
    <h4 className="font-semibold">Изолированный канал Radio Worker</h4>
    <p className="text-sm">Проверка звука, полученного от Worker отдельно от эфирного MP3-потока.</p>
    <label className="block text-sm">Учебный сценарий
      <select aria-label="Сценарий теста Radio Worker" value={workerLabScenario} onChange={e=>setWorkerLabScenario(e.target.value)} className="mt-1 block w-full max-w-sm rounded-lg border border-slate-300 bg-white text-slate-900 p-2 dark:border-white/20 dark:bg-slate-900 dark:text-white">
       <option value="resume">Прерывание → возврат музыки</option>
       <option value="stop">Прерывание → полная остановка</option>
       <option value="repeat">Два последовательных прерывания</option>
      </select>
    </label>
    <button type="button" onClick={()=>void playPreview('worker')} className="rounded-lg bg-violet-600 text-white px-4 py-2 text-sm">Прослушать тест Worker</button>
    <button type="button" onClick={stopPreview} className="rounded-lg border px-4 py-2 text-sm">Остановить</button>
    <p className="text-xs">Только наушники, изолированные от усилителя. Реальное вещание не переключается.</p>
  </div>
  <MchsWorkerInteractiveLab token={token} stopOtherPreview={stopPreview}/>
  <MchsFileAudioTest stopOtherPreview={stopPreview}/>
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
