import {useEffect,useState} from 'react';
import {api} from '../../../api/client.js';
import MchsWorkerServerSession from './MchsWorkerServerSession.jsx';

export default function MchsEmergencySimulation({token}){
 const [status,setStatus]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [assets,setAssets]=useState([]),[assetId,setAssetId]=useState('');
 const [dangerAssetId,setDangerAssetId]=useState(''),[clearAssetId,setClearAssetId]=useState('');
 const [sequenceBusy,setSequenceBusy]=useState(false),[sequenceResult,setSequenceResult]=useState(null);
 const [transportBusy,setTransportBusy]=useState(false),[transportResult,setTransportResult]=useState(null);
 const [pcmTrialBusy,setPcmTrialBusy]=useState(false),[pcmTrialResult,setPcmTrialResult]=useState(null);
 const [executionControl,setExecutionControl]=useState(null),[holdBusy,setHoldBusy]=useState(false);
 const [transitionPreview,setTransitionPreview]=useState(null);
 const refresh=async()=>{
  try{setStatus(await api('/safety/mchs-training-stream',{token}));setError('');}
  catch(e){setError(e.message||'Нет связи с Radio Worker');}
 };
 useEffect(()=>{api('/safety/mchs-training-stream/assets',{token}).then(data=>setAssets(data.assets||[])).catch(()=>setError('Не удалось загрузить категорию ALARM'));},[token]);
 useEffect(()=>{api('/safety/missile-execution-control',{token}).then(setExecutionControl).catch(()=>{});
  api('/safety/missile-alarm-transition-preview',{token}).then(setTransitionPreview).catch(()=>{});},[token]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},3000);return()=>clearInterval(timer);},[token]);
 const command=async action=>{
  if(action==='START'&&!window.confirm('Запустить учебное сообщение в ОСНОВНОМ радиопотоке? Звук получат интернет-слушатели и подключённые громкоговорители. Подтвердите, что аудитория предупреждена, запись явно учебная, громкость безопасная и доступна физическая остановка усилителя.'))return;
  setBusy(true);setError('');
  try{setStatus(await api('/safety/mchs-training-stream',{token,method:'POST',body:{action,assetId:action==='START'?assetId:null}}));}
  catch(e){setError(e.message||'Команда не выполнена');}
  finally{setBusy(false);}
 };
 return <section className="mchs-panel rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-4 sm:p-5 space-y-4">
  <div className="space-y-1">
   <h3 className="text-lg font-semibold">Учебное переключение основного радиопотока</h3>
   <p className="text-sm text-slate-600 dark:text-slate-300">Отдельный режим: учебная запись заменяет PCM перед общим MP3-кодировщиком. Она может быть слышна и на сайте, и через Windows Agent. Автоматические тревоги МЧС не задействованы.</p>
  </div>
  <div className="rounded-xl border border-amber-400/70 p-3 space-y-3">
   <h4 className="font-semibold">Учебный цикл: тревога → отбой → обычный эфир</h4>
   <p className="text-sm text-amber-700 dark:text-amber-300">Внимание: записи действительно прозвучат в ОСНОВНОМ радиопотоке. До запуска физически отключите громкоговорители, предупредите слушателей и используйте только записи с отчётливой пометкой «Учебная тревога».</p>
   <label className="block text-sm">Учебная тревога
    <select className="mt-1 w-full rounded-lg border p-2 bg-white text-slate-900 dark:bg-slate-900 dark:text-white" value={dangerAssetId} onChange={e=>setDangerAssetId(e.target.value)}>
     <option value="">Выбрать файл ALARM</option>
     {assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
   </label>
   <label className="block text-sm">Учебный отбой
    <select className="mt-1 w-full rounded-lg border p-2 bg-white text-slate-900 dark:bg-slate-900 dark:text-white" value={clearAssetId} onChange={e=>setClearAssetId(e.target.value)}>
     <option value="">Выбрать файл ALARM</option>
     {assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
   </label>
   <button type="button" disabled={sequenceBusy||!dangerAssetId||!clearAssetId||dangerAssetId===clearAssetId} className="rounded-lg border border-amber-500 px-3 py-2 disabled:opacity-50" onClick={async()=>{
    if(!window.confirm('ВНИМАНИЕ! Это РЕАЛЬНЫЙ ОСНОВНОЙ РАДИОПОТОК. Громкоговорители физически отключены, слушатели предупреждены, обе записи явно учебные. Запустить тревогу и отбой?'))return;
    setSequenceBusy(true);setSequenceResult(null);
    try{setSequenceResult(await api('/safety/mchs-training-sequence',{token,method:'POST',body:{dangerAssetId,clearAssetId,confirmation:'TRAINING_AUDIO_OUTPUT_ACKNOWLEDGED'}}));}
    catch(e){setSequenceResult({ok:false,reason:e.message||'Не удалось запустить учебный цикл'});}
    finally{setSequenceBusy(false);}
   }}>{sequenceBusy?'Учебный цикл выполняется…':'Запустить учебную тревогу и отбой'}</button>
   {sequenceResult&&<p role="status" className="text-sm">{sequenceResult.ok?'Учебный цикл завершён; проверьте фактический возврат к радиопрограмме.':('Ошибка или остановка: '+(sequenceResult.reason||'Проверьте Worker'))}</p>}
   <p className="text-xs text-slate-600 dark:text-slate-300">Для экстренной остановки используйте существующую кнопку STOP ниже. Не закрывайте страницу до завершения: разрыв запроса отменяет последовательность.</p>
  </div>
  <div className="rounded-xl border border-amber-300/50 p-3 space-y-3">
   <p className="text-sm font-medium">Основной поток: {status?.active?'Учебная запись':'Обычная программа'} · {status?.enabled?'Режим включён на сервере':'Режим выключен на сервере'}</p>
   {status?.active && <div className="space-y-1">
    <p className="text-sm">В эфире: {assets.find(a=>a.id===status.assetId)?.name || 'ALARM'} — {Math.floor((status.playedBytes || 0)/192000)} сек.</p>
    <progress className="w-full" value={status.playedBytes || 0} max={Math.max(1,status.totalBytes || 1)}/>
   </div>}
   {status?.finishedAt && <p className="text-xs">Последнее завершение: {status.lastStopReason || '—'} ({new Date(status.finishedAt).toLocaleTimeString('ru-RU')})</p>}
   <p className="text-xs text-slate-600 dark:text-slate-300">Запись ALARM воспроизводится до конца или до ручного STOP. Длинные записи подаются с диска, без загрузки целиком в память. Выберите уже загруженную запись ALARM. Сервер декодирует её автоматически; отдельно готовить PCM не требуется. Для первого теста используйте явно учебную запись, а не настоящий сигнал тревоги. Ни START, ни STOP не управляют ESP32 или усилителем.</p>
   <label className="block text-sm">Аудиозапись из категории ALARM
    <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 dark:bg-slate-900 dark:text-white" value={assetId} onChange={e=>setAssetId(e.target.value)}><option value="">Выберите запись</option>{assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
   </label>
   <div className="flex flex-wrap gap-2">
    <button type="button" disabled={busy||!assetId||!status?.enabled||status?.active} onClick={()=>void command('START')} className="rounded-lg bg-amber-600 px-3 py-2 text-white disabled:opacity-40">Включить учебную запись в эфир</button>
    <button type="button" disabled={busy} onClick={()=>void command('STOP')} className="rounded-lg bg-red-700 px-3 py-2 text-white disabled:opacity-50">СТОП / вернуть программу</button>
    <button type="button" onClick={()=>void refresh()} className="rounded-lg border px-3 py-2">Обновить</button>
   </div>
   {error&&<p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
  </div>
  <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-3">
   <h4 className="font-semibold">Автоматические ALARM — контроль готовности</h4>
   <p className="text-sm text-amber-700 dark:text-amber-300">Автоматическое включение реального эфира заблокировано до подтверждения официального источника и проверки исполнительного механизма.</p>
   <div className="grid grid-cols-2 gap-2 text-sm">
    <div>Автозапуск: <b>{executionControl?.executionEnabled?'Разрешён':'Отключён'}</b></div>
    <div>Состояние: <b>{executionControl?.checkpointState||'—'}</b></div>
    <div>В очереди: <b>{executionControl?.queue?.staged??'—'}</b></div>
    <div>Просрочено: <b>{executionControl?.queue?.expired??'—'}</b></div>
   </div>
   <div className="text-xs text-slate-600 dark:text-slate-300">Причины блокировки: {executionControl?.holds?.join(', ')||'Загрузка или нет данных'}</div>
   <div className="text-xs text-slate-600 dark:text-slate-300">Переходы ALARM: {transitionPreview?.transitionPlans?.length??'—'} предварительных решений · возврат к действующей эфирной сетке после окончания записи · реальное исполнение отключено.</div>
   <button type="button" disabled={holdBusy} className="rounded-lg border border-red-300 px-3 py-2 text-sm disabled:opacity-50" onClick={async()=>{
    setHoldBusy(true);
    try{await api('/safety/missile-execution-control/hold',{token,method:'POST'});
     setExecutionControl(await api('/safety/missile-execution-control',{token}));}
    catch(e){setError(e.message||'Не удалось установить блокировку');}
    finally{setHoldBusy(false);}
   }}>Заблокировать автоматическое исполнение</button>
   {executionControl?.recentIntents?.length>0&&<div className="text-xs space-y-1">
    <p className="font-semibold">Последние команды</p>
    {executionControl.recentIntents.slice(0,5).map(item=><p key={item.id}>{item.eventType} · {item.status}</p>)}
   </div>}
  </div>
  <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-2">
   <h4 className="font-semibold">Тревога → Отбой → Возврат к музыке (изолированный PCM-тест)</h4>
   <p className="text-xs text-slate-600 dark:text-slate-300">Проверяет существующий PCM-движок в памяти API на синтетических аудиокадрах. Общий эфир и усилитель не затрагиваются.</p>
   <button type="button" disabled={pcmTrialBusy} className="rounded-lg border px-3 py-2 disabled:opacity-50" onClick={async()=>{
    setPcmTrialBusy(true);setPcmTrialResult(null);
    try{setPcmTrialResult(await api('/safety/missile-alarm-pcm-trial',{token,method:'POST'}));}
    catch(e){setPcmTrialResult({ok:false,reason:e.message||'Ошибка PCM'});}
    finally{setPcmTrialBusy(false);}
   }}>{pcmTrialBusy?'Проверка…':'Проверить переходы ALARM без звука'}</button>
   {pcmTrialResult&&<p role="status" className="text-sm">{pcmTrialResult.ok&&pcmTrialResult.resumedNormalPcm?'Тест успешен: тревога, отбой и возврат к исходному PCM проверены.':'Тест не прошёл: '+(pcmTrialResult.reason||'Проверьте API')}</p>}
  </div>
  <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-2">
   <h4 className="font-semibold">Проверка доставки команд МЧС (без звука)</h4>
   <p className="text-xs text-slate-600 dark:text-slate-300">Синтетическая команда проверяет API → Radio Worker → PostgreSQL и защиту от повторов. Настоящие уведомления и эфир не затрагиваются.</p>
   <button type="button" disabled={transportBusy} onClick={async()=>{
    setTransportBusy(true);setTransportResult(null);
    try{setTransportResult(await api('/safety/missile-transport-smoke',{token,method:'POST'}));}
    catch(e){setTransportResult({ok:false,error:e.message||'Ошибка связи'});}
    finally{setTransportBusy(false);}
   }} className="rounded-lg border px-3 py-2 disabled:opacity-50">{transportBusy?'Проверка…':'Проверить доставку'}</button>
   {transportResult&&<p role="status" className="text-sm">{transportResult.ok?'Проверка успешна: команда получена, повтор распознан, подтверждение сохранено в PostgreSQL.':('Проверка не пройдена: '+(transportResult.error||'Не получено подтверждение'))}</p>}
  </div>
  <details className="rounded-xl border border-slate-200 dark:border-white/15 p-3">
   <summary className="cursor-pointer font-medium">Изолированная лабораторная сессия (архивные тесты)</summary>
   <div className="mt-3"><MchsWorkerServerSession token={token}/></div>
  </details>
 </section>;
}
