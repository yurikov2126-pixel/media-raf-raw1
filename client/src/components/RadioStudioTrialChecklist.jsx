import {useState} from 'react';

/** Local-only checklist: not an on-air permit. */
export default function RadioStudioTrialChecklist({health,role}){
 const [disconnected,setDisconnected]=useState(false);
 const [headphones,setHeadphones]=useState(false);
 const checks=[
  ['physical',disconnected,'Школьные усилители и PA физически отключены от тестового тракта'],
  ['headphones',headphones,'Прослушивание только в наушниках; настроен mix-minus на RØDECaster Duo'],
  ['pilot',health?.pilotEnabled===true,'Серверный PCM-шлюз разрешён'],
  ['worker',health?.workerReachable===true,'PCM Worker доступен'],
  ['gateway',health?.decoderRunning===true,'Opus/FFmpeg-декодер работает'],
  ['mic',health?.transportConnected===true,'Ведущий подключён'],
  ['pcm',Number.isFinite(health?.pcmAgeMs)&&health.pcmAgeMs>=0&&health.pcmAgeMs<1500,'PCM обновляется без задержки более 1,5 секунды'],
  ['isolated',health?.liveOutputConnected===false,'Основной аудиовыход не подключён к экспериментальному PCM'],
 ];
 const ready=checks.every(x=>x[1]);
 return <div className="rounded-xl border border-current/15 p-4 space-y-3">
   <h3 className="font-semibold">Проверка перед тестом на Mac / Windows</h3>
   <p className="text-xs opacity-70">Это только контрольная карта изолированного теста, не разрешение на публичный эфир.</p>
   {health?.pilotEnabled===false&&<p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-300">Серверный PCM-шлюз отключён. {health?.opusEnabled===false?'Для начала нужен RADIO_BROWSER_OPUS_UPLINK_ENABLED=true на API.':'Для прослушивания нужен RADIO_BROWSER_PCM_GATEWAY_ENABLED=true на API.'} Настройки меняются администратором на изолированном стенде, не в браузере.</p>}
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={disconnected}
     onChange={e=>setDisconnected(e.target.checked)} className="mt-1"/>
     Школьная акустика и усилитель физически отключены от испытания</label>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={headphones}
     onChange={e=>setHeadphones(e.target.checked)} className="mt-1"/>
     Наушники подключены, USB mix-minus настроен</label>
   <div className="grid gap-1 text-xs">
    {checks.slice(2).map(([id,ok,label])=><p key={id} className={ok?'text-emerald-600 dark:text-emerald-400':'text-amber-600 dark:text-amber-400'}>
      {ok?'✓':'○'} {label}</p>)}
   </div>
   <p role="status" className="text-sm font-medium">{ready&&role==='presenter'?
      'Можно проводить изолированное прослушивание в наушниках. Публичный эфир по-прежнему запрещён.':
      'Изолированный тест пока не подтверждён. Проверьте оборудование и диагностические показатели.'}</p>
 </div>;
}
