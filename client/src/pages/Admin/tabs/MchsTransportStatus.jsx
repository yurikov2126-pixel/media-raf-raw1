import {useCallback,useEffect,useState} from 'react';
import {api} from '../../../api/client.js';

const names={
 WORKER_NOT_REACHABLE:'Radio Worker не отвечает',
 AGENT_NOT_CONNECTED:'Windows Agent не подключён',
 TRIAL_STOP_NOT_CONFIRMED:'Остановка лабораторного VLC не подтверждена',
 ESP32_STATUS_STALE_OR_MISSING:'Нет свежей телеметрии ESP32',
 ESP32_STATUS_AMBIGUOUS:'Неоднозначная телеметрия ESP32',
 ESP32_STATUS_INVALID:'Данные ESP32 неполные или некорректны',
 ESP32_AGENT_DISCONNECTED:'ESP32 сообщает об отключении Windows Agent',
 ESP32_NO_VALID_CONTROL_LEASE:'ESP32 не имеет действующего разрешения управления',
 ESP32_HEARTBEAT_NOT_CONFIRMED:'Heartbeat ESP32 не подтверждён',
 ESP32_LEASE_NOT_CONFIRMED:'Разрешение ESP32 (lease) не подтверждено',
 PA_OUTPUT_NOT_INDEPENDENTLY_VERIFIED:'Физическое состояние громкоговорителей не подтверждено',
 WORKER_UNAVAILABLE:'Radio Worker недоступен',
 AGENT_UNCONFIRMED:'Нет подтверждения связи Windows Agent',
 STOP_NOT_CONFIRMED:'Остановка звукового процесса не подтверждена',
 ESP32_NOT_CONFIRMED:'Безопасное состояние ESP32 не подтверждено',
 ALARM_RULES_INCOMPLETE:'Настройки двух оповещений неполные',
 RULE_DISABLED:'Обработка события выключена',
 ALARM_AUDIO_MISSING:'Назначенный ALARM не найден',
 INVALID_REPEATS:'Некорректное число повторов'
};
const yesNo=value=>value===true?'Подтверждено':value===false?'Нет подтверждения':'Нет данных';
export default function MchsTransportStatus({token}){
 const [data,setData]=useState(null);
 const [preflight,setPreflight]=useState(null);
 const [error,setError]=useState('');
 const [updated,setUpdated]=useState(null);
 const [loading,setLoading]=useState(false);
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{
   const [result,checks]=await Promise.all([api('/safety/missile-dispatch-readiness',{token}),api('/safety/missile-live-trial-preflight',{token})]);
   setData(result);setPreflight(checks);setError('');setUpdated(new Date());
  }catch(e){setData(null);setPreflight(null);setError(e.message||'Ошибка проверки состояния');}
  finally{setLoading(false);}
 },[token]);
 useEffect(()=>{
  let alive=true;
  const read=async()=>{try{
   const [result,checks]=await Promise.all([api('/safety/missile-dispatch-readiness',{token}),api('/safety/missile-live-trial-preflight',{token})]);
   if(alive){setData(result);setPreflight(checks);setError('');setUpdated(new Date());}
  }catch(e){if(alive){setError(e.message||'Нет связи с диагностикой');setData(null);setPreflight(null);}}};
  read();const timer=setInterval(read,15000);
  return ()=>{alive=false;clearInterval(timer);};
 },[token]);
 const chain=data?.transportChain;
 const cards=[
  {label:'Radio Worker',value:chain?.worker?.reachable?'Доступен':'Нет подтверждения',detail:'Доступность сервиса'},
  {label:'Windows Agent',value:chain?.agent?.connected?'Связь есть':'Нет подтверждения',detail:chain?.agent?.deviceBound?'Устройство привязано':'Устройство не привязано'},
  {label:'Лабораторный VLC',value:chain?.trial?.status==='LAB_PROCESS_STOP_CONFIRMED'?'Процесс завершён':'STOP_NOT_CONFIRMED',detail:'Только учебный процесс, не весь эфир'},
  {label:'ESP32',value:chain?.esp32?.fresh?'Телеметрия актуальна':'Нет свежих данных',detail:'Heartbeat: '+yesNo(chain?.esp32?.heartbeatFresh)+' · Lease: '+yesNo(chain?.esp32?.leaseValid)},
  {label:'Усилитель',value:chain?.esp32?.amplifierPower||'UNKNOWN',detail:'Сообщённое состояние, без физической проверки'}
 ];
 return <section className="mchs-panel rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-4 sm:p-5 space-y-4" aria-label="Диагностика тракта оповещения">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h3 className="text-lg font-semibold">Тракт оповещения</h3><p className="text-sm text-slate-600 dark:text-slate-300">Только диагностика. Автоматическая тревога отключена, физическое состояние громкоговорителей не подтверждено.</p></div>
   <button type="button" onClick={refresh} disabled={loading} className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-sm disabled:opacity-50">{loading?'Проверяем…':'Обновить'}</button>
  </div>
  {error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">Диагностика недоступна: {error}</p>}
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
   {cards.map(item=><div key={item.label} className="rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 p-3 min-w-0">
    <div className="text-xs text-slate-600 dark:text-slate-300">{item.label}</div>
    <strong className="block mt-1 text-sm break-words">{chain?item.value:'Ожидание данных'}</strong>
    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.detail}</p>
   </div>)}
  </div>
  <div className="rounded-xl border border-amber-300/60 dark:border-amber-400/30 p-3 space-y-2">
   <strong className="block text-sm">Разрешение на запуск: отсутствует</strong>
   <p className="text-xs text-slate-600 dark:text-slate-300">Даже полная телеметрия не разрешает автоматический ALARM и не подтверждает отсутствие звука в громкоговорителях.</p>
   {chain?.holds?.length>0&&<ul className="list-disc pl-5 text-sm space-y-1">{chain.holds.map((code,i)=><li key={code+'-'+i}>{names[code]||code}</li>)}</ul>}
  </div>
  <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-3">
   <strong className="block text-sm">Предпроверка двух реальных уведомлений МЧС</strong>
   <p className="text-xs text-slate-600 dark:text-slate-300">Проверяются текущие настройки и телеметрия реального оборудования. Никакое сообщение не генерируется и ALARM не включается.</p>
   <div className="grid gap-2 sm:grid-cols-2">
    {(preflight?.types||[]).map(item=><div key={item.type} className="rounded-lg border border-slate-200 dark:border-white/15 p-3">
     <strong className="text-sm">{item.type==='MISSILE_DANGER'?'Ракетная опасность':'Отбой ракетной опасности'}</strong>
     <p className="text-xs mt-1 break-all">ALARM: {item.audioAssetId||'Не выбран'} · Повторы: {item.repeats}</p>
     <p className="text-xs mt-1">{item.configured?'Конфигурация заполнена':item.reasons.map(code=>names[code]||code).join('; ')}</p>
    </div>)}
   </div>
   {preflight?.holds?.length>0&&<ul className="list-disc pl-5 text-xs space-y-1">{preflight.holds.map(code=><li key={code}>{names[code]||code}</li>)}</ul>}
   <p className="text-xs font-medium">Автоматическая отправка ALARM: {preflight?.automaticPlaybackEnabled?'Включена':'Заблокирована'} · Разрешение на усилитель: отсутствует.</p>
  </div>
  <p className="text-xs text-slate-600 dark:text-slate-300">Последнее обновление: {updated?updated.toLocaleString('ru-RU'):'Нет данных'} · Автопроверка каждые 15 секунд.</p>
 </section>;
}
