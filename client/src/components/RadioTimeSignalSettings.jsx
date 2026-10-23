import {useEffect,useState} from 'react';
import {api} from '../api/client.js';
const HOURS=Array.from({length:24},(_,i)=>i);
export default function RadioTimeSignalSettings({token}){
 const [settings,setSettings]=useState(null),[assets,setAssets]=useState([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[note,setNote]=useState('');
 useEffect(()=>{
  let active=true;
  const run=async()=>{
   try{
    const all=[];
    for(let page=1;;page++){
     const r=await api('/radio/assets/browse?category=TIME_SIGNAL&limit=100&page='+page,{token});
     const batch=Array.isArray(r.assets)?r.assets:[];
     all.push(...batch);
     if(all.length>=Number(r.total)||batch.length<100)break;
    }
    const result=await api('/radio/time-signal',{token});
    if(active){setAssets(all.filter(a=>a.durationMs>=1000&&a.durationMs<=60000));setSettings(result.settings);}
   }catch(e){if(active)setError(e.message||'Не удалось получить настройки');}
   finally{if(active)setLoading(false);}
  };
  void run();return()=>{active=false;};
 },[token]);
 const change=(key,value)=>setSettings(v=>({...v,[key]:value}));
 const save=async e=>{
  e.preventDefault();setBusy(true);setError('');setNote('');
  try{
   const response=await api('/radio/time-signal',{token,method:'PUT',body:settings});
   setSettings(response.settings);
   setNote('Настройки сохранены. На этом этапе часовой сигнал ещё не подключён к эфирному Worker.');
  }catch(e){setError(e.message||'Ошибка сохранения');}
  finally{setBusy(false);}
 };
 if(loading)return <section className="rounded-xl border border-current/15 p-4">Загрузка объявлений времени…</section>;
 if(!settings)return <section className="rounded-xl border border-current/15 p-4" role="alert">{error||'Данные недоступны'}</section>;
 const filled=settings.hourAssetIds.filter(Boolean).length;
 return <section className="space-y-4 rounded-2xl border border-current/15 p-4 sm:p-5">
  <header><h2 className="text-lg font-semibold">Объявление времени · точный час</h2><p className="mt-1 text-xs opacity-65">Этап 1: библиотека записей и подготовка настроек. Фактическое воспроизведение будет активировано отдельным этапом после проверки PCM Worker.</p></header>
  <form className="space-y-4" onSubmit={save}>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.enabled} onChange={e=>change('enabled',e.target.checked)}/>Разрешить часовые объявления после подключения эфирного планировщика</label>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="block text-sm">Режим перехода<select className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" value={settings.mode} onChange={e=>change('mode',e.target.value)}><option value="BALANCED">Сбалансированный</option><option value="STRICT">Строго в нулевую минуту</option><option value="SOFT">Доиграть трек</option></select></label>
    <label className="block text-sm">Порог прерывания, сек.<input className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" type="number" min="15" max="180" value={settings.thresholdSeconds} onChange={e=>change('thresholdSeconds',Number(e.target.value))}/></label>
    <label className="block text-sm">Максимальное опоздание, сек.<input className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" type="number" min="0" max="180" value={settings.maxDelaySeconds} onChange={e=>change('maxDelaySeconds',Number(e.target.value))}/></label>
    <label className="block text-sm">Затухание, мс<input className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" type="number" min="0" max="5000" step="250" value={settings.fadeMs} onChange={e=>change('fadeMs',Number(e.target.value))}/></label>
   </div>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.preRoll} onChange={e=>change('preRoll',e.target.checked)}/>Предварительная подготовка часовой записи</label>
   <p className="text-xs opacity-60">Часовой пояс станции: Москва (UTC+3). Назначено {filled} из 24 часов.</p>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {HOURS.map(hour=><label key={hour} className="rounded-xl border border-current/15 p-3 text-sm"><span className="mb-2 block font-semibold">{String(hour).padStart(2,'0')}:00</span>
      <select className="w-full min-w-0 rounded-lg border border-current/20 bg-transparent p-2" value={settings.hourAssetIds[hour]||''} onChange={e=>change('hourAssetIds',settings.hourAssetIds.map((v,i)=>i===hour?e.target.value||null:v))}>
       <option value="">Не назначено — пропустить</option>{assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
      </select></label>)}
   </div>
   {!assets.length&&<p className="text-sm opacity-65">В медиатеке нет записей категории «Объявления времени» длительностью 1–60 секунд. Назначьте категорию файлам или папке.</p>}
   <button disabled={busy} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?'Сохранение…':'Сохранить настройки'}</button>
  </form>
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  {note&&<p role="status" className="text-sm text-emerald-600">{note}</p>}
 </section>;
}
