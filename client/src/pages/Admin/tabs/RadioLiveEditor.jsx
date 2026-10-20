import {useEffect,useMemo,useState} from 'react';
import {api} from '../../../api/client.js';
import {RADIO_LIVE_DEFAULTS,RADIO_LIVE_FIELDS,normalizeRadioLiveDesign} from '../../../lib/radioLiveDesign.js';

const sections=[
 ['Тексты и бренд',['headerSubtitle','eyebrow','stationTagline','heroLine1','heroLine2','heroLine3','description']],
 ['Приглашение и подвал',['inviteEyebrow','inviteTitle','inviteDescription','inviteButton','sideFooter','footerText']]
];
const switches=[
 ['showInvite','Показывать приглашение поделиться'],
 ['showWaves','Показывать анимированные волны'],
 ['showSideFooter','Показывать нижнюю подпись'],
 ['showStationClock','Показывать часы станции']
];
export default function RadioLiveEditor({token}){
 const [design,setDesign]=useState({...RADIO_LIVE_DEFAULTS});
 const [original,setOriginal]=useState({...RADIO_LIVE_DEFAULTS});
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [mobile,setMobile]=useState(false);
 const [section,setSection]=useState(0);
 useEffect(()=>{
  let active=true;
  api('/radio-agent/dashboard/live-design',{token}).then(response=>{
   if(!active)return;
   const value=normalizeRadioLiveDesign(response);
   setDesign(value);setOriginal(value);
  }).catch(e=>{if(active)setError(e.message||'Не удалось загрузить оформление');})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[token]);
 const dirty=useMemo(()=>JSON.stringify(design)!==JSON.stringify(original),[design,original]);
 useEffect(()=>{
  const beforeUnload=e=>{if(dirty){e.preventDefault();e.returnValue='';}};
  window.addEventListener('beforeunload',beforeUnload);
  return()=>window.removeEventListener('beforeunload',beforeUnload);
 },[dirty]);
 const change=(key,value)=>{setDesign(d=>({...d,[key]:value}));setSuccess('');};
 const save=async()=>{
  setSaving(true);setError('');setSuccess('');
  try{
   const result=normalizeRadioLiveDesign(await api('/radio-agent/dashboard/live-design',{method:'PUT',token,body:design}));
   setOriginal(result);setDesign(result);setSuccess('Опубликовано. Изменения доступны слушателям после обновления страницы.');
  }catch(e){setError(e.message||'Ошибка сохранения');}
  finally{setSaving(false);}
 };
 const reset=()=>{
  if(window.confirm('Вернуть настройки оформления по умолчанию? Сохранённая версия не изменится до публикации.'))
   setDesign({...RADIO_LIVE_DEFAULTS});
 };
 const restore=()=>setDesign({...original});
 const textInput=(key,label,max)=>(
  <label key={key} className="block space-y-1.5 text-sm font-medium">
   <span>{label}</span>
   {max>150?<textarea rows={3} maxLength={max} className="input w-full" value={design[key]} onChange={e=>change(key,e.target.value)}/>:
   <input maxLength={max} className="input w-full" value={design[key]} onChange={e=>change(key,e.target.value)}/>}
   <span className="block text-right text-xs opacity-60">{design[key].length}/{max}</span>
  </label>
 );
 return <div className="space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="text-2xl font-bold">Редактор radio/live</h2>
    <p className="mt-1 text-sm opacity-70">Тексты, оформление и видимость блоков. Предпросмотр не влияет на работающий эфир.</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <button type="button" onClick={()=>window.open('/radio/live','_blank','noopener')} className="rounded-xl border border-current/30 px-4 py-2 text-sm font-semibold">Открыть страницу ↗</button>
    <button type="button" onClick={restore} disabled={!dirty||saving} className="rounded-xl border border-current/30 px-4 py-2 text-sm disabled:opacity-40">Отменить правки</button>
    <button type="button" onClick={save} disabled={!dirty||saving||loading} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-40">{saving?'Публикация…':dirty?'Опубликовать изменения':'Сохранено'}</button>
   </div>
  </header>
  {error&&<p className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-3 text-sm text-rose-500" role="alert">{error}</p>}
  {success&&<p className="rounded-xl border border-emerald-500/50 p-3 text-sm text-emerald-600 dark:text-emerald-300" role="status">{success}</p>}
  {loading?<p>Загрузка оформления…</p>:
  <div className="grid items-start gap-5 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.25fr)]">
   <div className="space-y-4">
    <section className="radio-panel rounded-2xl border p-4">
     <div className="mb-4 flex flex-wrap gap-2">
      {sections.map(([name],i)=><button key={name} type="button" onClick={()=>setSection(i)}
       className={`rounded-lg px-3 py-2 text-sm font-semibold ${section===i?'bg-indigo-600 text-white':'border border-current/20'}`}>{name}</button>)}
     </div>
     <div className="space-y-3">
      {sections[section][1].map(key=>{
       const field=RADIO_LIVE_FIELDS.find(item=>item[0]===key);
       return textInput(...field);
      })}
     </div>
    </section>
    <section className="radio-panel rounded-2xl border p-4">
     <h3 className="mb-4 text-lg font-semibold">Оформление</h3>
     <div className="grid gap-4 sm:grid-cols-2">
      {[['accent','Акцентный цвет'],['background','Фон']].map(([key,label])=>
       <label key={key} className="flex items-center justify-between gap-3 text-sm font-semibold">{label}
        <span className="flex items-center gap-2"><input type="color" aria-label={label} value={design[key]} onChange={e=>change(key,e.target.value)} className="h-10 w-11 cursor-pointer rounded-lg border border-current/20"/>
         <span className="font-mono text-xs opacity-70">{design[key]}</span></span>
       </label>)}
     </div>
     <div className="mt-4 space-y-3">{switches.map(([key,label])=>
      <label key={key} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={design[key]} onChange={e=>change(key,e.target.checked)} className="h-4 w-4 accent-indigo-600"/>{label}</label>)}</div>
     <button type="button" onClick={reset} className="mt-5 rounded-lg border border-current/25 px-3 py-2 text-sm">Вернуть стандартное оформление</button>
    </section>
   </div>
   <section className="radio-panel min-w-0 rounded-2xl border p-4">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
     <div><h3 className="font-semibold">Предпросмотр</h3><p className="text-xs opacity-65">Изменения отображаются до публикации</p></div>
     <div className="flex gap-2">
      <button type="button" onClick={()=>setMobile(false)} className={`rounded-lg border px-3 py-1.5 text-xs ${!mobile?'bg-indigo-600 text-white':'border-current/20'}`}>ПК</button>
      <button type="button" onClick={()=>setMobile(true)} className={`rounded-lg border px-3 py-1.5 text-xs ${mobile?'bg-indigo-600 text-white':'border-current/20'}`}>Телефон</button>
     </div>
    </div>
    <div className={`mx-auto overflow-hidden rounded-[1.5rem] border border-white/15 p-5 shadow-2xl transition-all ${mobile?'max-w-[360px]':''}`}
     style={{background:design.background,color:'#fff',borderColor:design.accent}}>
     <div className="mb-5 flex items-center justify-between text-xs font-bold tracking-wide">
      <span>◉ MEDIA · РАФ · RAW</span><span style={{color:design.accent}}>● В ЭФИРЕ</span>
     </div>
     <p className="mb-1 text-[10px] uppercase opacity-70">{design.headerSubtitle}</p>
     <div className={mobile?'space-y-5':'grid grid-cols-2 gap-5'}>
      <div className="space-y-4 rounded-2xl border border-white/15 bg-white/5 p-4">
       <span className="text-[10px] uppercase tracking-widest opacity-70">{design.eyebrow}</span>
       <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-white/10 text-2xl font-black" style={{boxShadow:`0 0 40px ${design.accent}40`}}>РАФ</div>
       <div className="text-center"><p className="text-[10px] uppercase opacity-70">♫ Музыкальный эфир</p><h4 className="mt-2 text-lg font-bold">Название композиции</h4><p className="text-xs opacity-75">Исполнитель</p></div>
       {design.showWaves&&<div className="flex h-7 items-center justify-center gap-1" aria-hidden>{[8,19,13,25,15,21,11,17,8].map((h,i)=><i key={i} className="w-1 rounded-lg" style={{height:h,background:design.accent}}/>)}</div>}
       <div className="h-1.5 rounded-full bg-white/15"><div className="h-full w-2/5 rounded-full" style={{background:design.accent}}/></div>
       <div className="text-center text-xs opacity-70">1:20 / 3:20　 ▶</div>
      </div>
      <div className="space-y-4">
       <p className="text-[10px] font-bold tracking-widest" style={{color:design.accent}}>{design.stationTagline}</p>
       <div className="text-2xl font-extrabold leading-tight"><div>{design.heroLine1}</div><div style={{color:design.accent}}>{design.heroLine2}</div><div>{design.heroLine3}</div></div>
       <p className="text-xs leading-relaxed opacity-80">{design.description}</p>
       {design.showInvite&&<div className="rounded-2xl border border-white/15 bg-white/5 p-3">
        <p className="text-[9px] font-bold opacity-65">{design.inviteEyebrow}</p>
        <p className="mt-2 font-bold">{design.inviteTitle}</p><p className="mt-1 text-xs opacity-75">{design.inviteDescription}</p>
        <span className="mt-3 inline-block rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{background:design.accent}}>{design.inviteButton}</span>
       </div>}
       {design.showSideFooter&&<p className="text-xs opacity-60">{design.sideFooter}</p>}
       {design.showStationClock&&<p className="text-xs opacity-75">Москва · {new Date().toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'})}</p>}
      </div>
     </div>
     <p className="mt-5 border-t border-white/10 pt-3 text-[10px] opacity-65">{design.footerText}</p>
    </div>
    <p className="mt-3 text-xs opacity-60">Упрощённый визуальный предпросмотр. Эфир, сетка и настройки звука не меняются.</p>
   </section>
  </div>}
 </div>;
}
