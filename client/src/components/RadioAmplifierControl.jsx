import {useCallback,useEffect,useState} from 'react';
import {api} from '../api/client.js';
export default function RadioAmplifierControl({token}){
 const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const refresh=useCallback(async()=>{try{setState(await api('/radio-agent/amplifier',{token}));setError('');}catch(e){setError(e.message||'Нет связи с сервером');}},[token]);
 useEffect(()=>{void refresh();const i=setInterval(refresh,6000);return()=>clearInterval(i);},[refresh]);
 const change=async patch=>{
  if(busy||!state)return;
  if(patch.manualOn===true&&!window.confirm('Запросить включение усилителя? Физическое реле пока заблокировано до аппаратной проверки.'))return;
  setBusy(true);
  try{const data=await api('/radio-agent/amplifier/policy',{token,method:'POST',body:{...state.policy,...patch}});setState(data);}
  catch(e){setError(e.message||'Не удалось изменить режим');}
  finally{setBusy(false);}
 };
 return <section className="rounded-2xl border border-current/15 p-4 space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-lg">Усилитель · ESP32</h3>
    <span className="text-xs rounded-full border border-current/20 px-3 py-1">{state?.connection==='ONLINE'?'● ESP32 на связи':'○ Нет связи с ESP32'}</span></div>
  <p className="text-sm opacity-75">Физическое реле: <strong>{state?.physicalRelay||"НЕИЗВЕСТНО"}</strong> · GPIO 13 · {state?.hardwareReady?"Управление активно":"Нет подтверждения готовности"}</p>
  <div className="flex flex-wrap gap-2">
   <button disabled={busy||!state} className={'rounded-xl px-4 py-2 text-sm border '+(state?.policy?.mode==='AUTO'?'bg-indigo-600 text-white':'border-current/20')} onClick={()=>change({mode:'AUTO',manualOn:false})}>Автоматически</button>
   <button disabled={busy||!state} className={'rounded-xl px-4 py-2 text-sm border '+(state?.policy?.mode==='MANUAL'?'bg-indigo-600 text-white':'border-current/20')} onClick={()=>change({mode:'MANUAL'})}>Вручную</button>
   {state?.policy?.mode==='MANUAL'&&<button disabled={busy} className="rounded-xl border border-current/20 px-4 py-2 text-sm" onClick={()=>change({manualOn:!state.policy.manualOn})}>{state.policy.manualOn?'Запрос: ВЫКЛ':'Запрос: ВКЛ'}</button>}
   <button disabled={busy||!state} className="rounded-xl border border-rose-500/40 px-4 py-2 text-rose-600 text-sm font-semibold" onClick={()=>change({emergencyOff:!state.policy.emergencyOff,manualOn:false})}>{state?.policy?.emergencyOff?'Снять аварийную блокировку':'Аварийный СТОП'}</button>
  </div>
  <p className="text-sm">Запрос питания: <strong>{state?.requested?'ВКЛ':'ВЫКЛ'}</strong> · {state?.reason||'Загрузка'}.</p>
  <p className="text-xs opacity-70">Расписание учитывается за 60 секунд; Auto-DJ — при включении. Запрос является политикой платформы. Состояние ON_COMMANDED/OFF_COMMANDED приходит от ESP32 и подтверждает команду GPIO, но не измеряет наличие питания на клеммах усилителя.</p>
  {error&&<p role="alert" className="text-red-500 text-sm">{error}</p>}
 </section>;
}
