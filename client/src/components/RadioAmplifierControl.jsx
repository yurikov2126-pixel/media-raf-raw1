import {useCallback,useEffect,useState} from 'react';
import {api} from '../api/client.js';
export default function RadioAmplifierControl({token}){
 const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [pre,setPre]=useState('60'),[post,setPost]=useState('30'),[dirty,setDirty]=useState(false);
 const refresh=useCallback(async()=>{try{const result=await api('/radio-agent/amplifier',{token});setState(result);if(!dirty){setPre(String(result.policy.preSeconds));setPost(String(result.policy.postSeconds));}setError('');}catch(e){setError(e.message||'Нет связи с сервером');}},[token,dirty]);
 useEffect(()=>{void refresh();const i=setInterval(refresh,6000);return()=>clearInterval(i);},[refresh]);
 const change=async patch=>{
  if(busy||!state)return;
  if(patch.manualOn===true&&!window.confirm('Запросить включение усилителя? Команда может переключить физическое реле GPIO13.'))return;
  setBusy(true);
  try{const data=await api('/radio-agent/amplifier/policy',{token,method:'POST',body:{...state.policy,...patch}});setState(data);setPre(String(data.policy.preSeconds));setPost(String(data.policy.postSeconds));setDirty(false);}
  catch(e){setError(e.message||'Не удалось изменить режим');}
  finally{setBusy(false);}
 };
 return <section className="rounded-2xl border border-current/15 p-4 space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-lg">Усилитель · ESP32</h3>
    <span className="text-xs rounded-full border border-current/20 px-3 py-1">{state?.connection==='ONLINE'?'● ESP32 на связи':'○ Нет связи с ESP32'}</span></div>
  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite">
   {[
    ['Питание усилителя',state?.physicalRelay==='ON_COMMANDED'?'● Команда ВКЛ':state?.physicalRelay==='OFF_COMMANDED'?'○ Команда ВЫКЛ':'Состояние неизвестно',state?.physicalRelay==='ON_COMMANDED'?'text-emerald-600 dark:text-emerald-400':''],
    ['Управление',state?.policy?.emergencyOff?'АВАРИЙНЫЙ СТОП':state?.policy?.mode==='AUTO'?'Автоматически':'Вручную',state?.policy?.emergencyOff?'text-rose-600':''],
    ['Связь с ESP32',state?.connection==='ONLINE'?'● На связи':'○ Нет связи',state?.connection==='ONLINE'?'text-emerald-600 dark:text-emerald-400':'text-amber-600'],
    ['Основание команды',state?.reason||'Нет данных','']
   ].map(([name,value,tone])=><div key={name} className="min-w-0 rounded-xl border border-current/10 bg-white/70 p-3 dark:bg-slate-900/50"><p className="text-xs opacity-65">{name}</p><p className={'mt-2 break-words text-sm font-semibold '+tone}>{value}</p></div>)}
  </div>
  <div className="flex flex-wrap gap-2 text-xs" aria-label="Схема управления">
   <span className="rounded-lg bg-indigo-500/10 px-3 py-2">Сервер → Windows Agent → ESP32</span>
   <span className="rounded-lg border border-current/15 px-3 py-2">GPIO 13 · HIGH включает</span>
   <span className="rounded-lg border border-current/15 px-3 py-2">Разрешение: {state?.leaseValid?'активно':'не активно'}</span>
  </div>
  <p className="text-sm opacity-75">Физическое реле: <strong>{state?.physicalRelay||"НЕИЗВЕСТНО"}</strong> · GPIO 13 · {state?.hardwareReady?"Управление активно":"Нет подтверждения готовности"}</p>
  <div className="flex flex-wrap gap-2">
   <button disabled={busy||!state} className={'rounded-xl px-4 py-2 text-sm border '+(state?.policy?.mode==='AUTO'?'bg-indigo-600 text-white':'border-current/20')} onClick={()=>change({mode:'AUTO',manualOn:false})}>Автоматически</button>
   <button disabled={busy||!state} className={'rounded-xl px-4 py-2 text-sm border '+(state?.policy?.mode==='MANUAL'?'bg-indigo-600 text-white':'border-current/20')} onClick={()=>change({mode:'MANUAL'})}>Вручную</button>
   {state?.policy?.mode==='MANUAL'&&<button disabled={busy} className="rounded-xl border border-current/20 px-4 py-2 text-sm" onClick={()=>change({manualOn:!state.policy.manualOn})}>{state.policy.manualOn?'Запрос: ВЫКЛ':'Запрос: ВКЛ'}</button>}
   <button disabled={busy||!state} className="rounded-xl border border-rose-500/40 px-4 py-2 text-rose-600 text-sm font-semibold" onClick={()=>change({emergencyOff:!state.policy.emergencyOff,manualOn:false})}>{state?.policy?.emergencyOff?'Снять аварийную блокировку':'Аварийный СТОП'}</button>
  </div>
  <div className="rounded-xl border border-current/10 p-3 space-y-3">
    <p className="text-sm font-semibold">Время работы усилителя по расписанию</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm space-y-1"><span className="block">Включить за (секунд)</span>
        <input type="number" min="0" max="600" step="1" value={pre} onChange={e=>{setPre(e.target.value);setDirty(true);}} className="w-full rounded-lg border border-current/20 bg-transparent px-3 py-2"/>
      </label>
      <label className="text-sm space-y-1"><span className="block">Выключить через (секунд после окончания)</span>
        <input type="number" min="0" max="600" step="1" value={post} onChange={e=>{setPost(e.target.value);setDirty(true);}} className="w-full rounded-lg border border-current/20 bg-transparent px-3 py-2"/>
      </label>
    </div>
    <div className="flex flex-wrap gap-2">{[10,30,60,120].map(n=><button key={n} type="button" onClick={()=>{setPre(String(n));setPost(String(n));setDirty(true);}} className="rounded-lg border border-current/15 px-3 py-1.5 text-xs transition hover:bg-indigo-500/10">{n} сек до и после</button>)}</div>
    <div className="flex flex-wrap items-center gap-3">
      <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy||!state||!dirty||pre.trim()===''||post.trim()===''||!Number.isInteger(Number(pre))||!Number.isInteger(Number(post))||Number(pre)<0||Number(pre)>600||Number(post)<0||Number(post)>600} onClick={()=>change({preSeconds:Number(pre),postSeconds:Number(post)})}>Сохранить время</button>
      <span className="text-xs opacity-70">От 0 до 600 секунд. По умолчанию: 60 / 30.</span>
    </div>
  </div>
  <p className="text-sm">Запрос питания: <strong>{state?.requested?'ВКЛ':'ВЫКЛ'}</strong> · {state?.reason||'Загрузка'}.</p>
  <p className="text-xs opacity-70">Расписание удерживает питание от начала с учётом подготовки до окончания с учётом задержки; Auto-DJ — при включении. Запрос является политикой платформы. Состояние ON_COMMANDED/OFF_COMMANDED приходит от ESP32 и подтверждает команду GPIO, но не измеряет наличие питания на клеммах усилителя.</p>
  {error&&<p role="alert" className="text-red-500 text-sm">{error}</p>}
 </section>;
}
