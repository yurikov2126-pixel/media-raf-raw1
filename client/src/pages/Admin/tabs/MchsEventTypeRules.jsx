import {useEffect,useRef,useState} from 'react';
import {api} from '../../../api/client.js';

const AUDIO_API=import.meta.env.VITE_API||'http://localhost:4000/api';
const TYPES=[
 {id:'MISSILE_DANGER',label:'Ракетная опасность',hint:'При получении сообщения воспроизвести выбранный файл заданное число раз'},
 {id:'MISSILE_ALL_CLEAR',label:'Отбой ракетной опасности',hint:'При получении отбоя воспроизвести выбранный файл один раз'}
];

/** Only production-supported event types. No obsolete simulation-mode selector. */
export default function MchsEventTypeRules({token}){
 const [data,setData]=useState(null);
 const [rules,setRules]=useState({});
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [saving,setSaving]=useState('');
 const [playing,setPlaying]=useState('');
 const player=useRef(null);
 const blobUrl=useRef(null);
 const revoke=()=>{
  player.current?.pause();
  if(player.current){player.current.removeAttribute('src');player.current.load();}
  if(blobUrl.current){URL.revokeObjectURL(blobUrl.current);blobUrl.current=null;}
  setPlaying('');
 };
 useEffect(()=>{
  let alive=true;
  api('/safety/event-type-rules',{token}).then(result=>{
   if(alive){setData(result);setRules(result.rules||{});}
  }).catch(e=>{if(alive)setError(e.message||'Не удалось загрузить назначения');});
  return()=>{alive=false;player.current?.pause();
   if(blobUrl.current)URL.revokeObjectURL(blobUrl.current);};
 },[token]);
 const change=(id,key,value)=>setRules(old=>({
  ...old,[id]:{...old[id],[key]:value}
 }));
 const preview=async(id)=>{
  if(playing===id){revoke();return;}
  const assetId=rules[id]?.audioAssetId;
  if(!assetId)return;
  revoke();setError('');
  try{
   const response=await fetch(AUDIO_API+'/radio/assets/'+encodeURIComponent(assetId)+'/audio',{
    headers:{Authorization:'Bearer '+token}
   });
   if(!response.ok)throw new Error('Не удалось загрузить аудиофайл');
   const url=URL.createObjectURL(await response.blob());
   blobUrl.current=url;player.current.src=url;player.current.volume=0.35;
   await player.current.play();setPlaying(id);
  }catch(e){revoke();setError(e.message||'Ошибка воспроизведения');}
 };
 const save=async(id)=>{
  const rule=rules[id]||{};
  if(!rule.audioAssetId){setError('Выберите файл для оповещения');return;}
  setSaving(id);setError('');setMessage('');
  try{
   await api('/safety/event-type-rules/'+id,{token,method:'PUT',
    body:{mode:'REVIEW',audioAssetId:rule.audioAssetId,
     repeats:id==='MISSILE_ALL_CLEAR'?1:Number(rule.repeats||1),
     note:rule.note||''}});
   change(id,'mode','REVIEW');
   setMessage('Настройки оповещения сохранены.');
  }catch(e){setError(e.message||'Не удалось сохранить');}
  finally{setSaving('');}
 };
 return <section className="space-y-4">
  <audio ref={player} onEnded={revoke} aria-label="Прослушивание файла на компьютере администратора"/>
  <div className="rounded-2xl border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-white/5 p-4 sm:p-5 space-y-2">
   <h3 className="text-lg font-semibold">Звуковые оповещения</h3>
   <p className="text-sm text-slate-600 dark:text-slate-300">Настроены только два рабочих события для Тульской области. Назначенные файлы воспроизводятся через основной Radio Worker при поступлении допустимого Android-уведомления.</p>
   <p className="text-xs text-slate-500 dark:text-slate-400">Прослушивание файла запускается вручную только на этом устройстве администратора. Оно не подаёт звук в эфир.</p>
  </div>
  {error&&<p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
  {message&&<p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
  {!data&&!error&&<p className="text-sm">Загрузка назначений…</p>}
  {data&&<div className="grid gap-4 lg:grid-cols-2">
   {TYPES.map(type=>{
    const rule=rules[type.id]||{};
    const asset=(data.assets||[]).find(a=>a.id===rule.audioAssetId);
    const reps=type.id==='MISSILE_ALL_CLEAR'?1:Number(rule.repeats||1);
    return <article key={type.id} className="rounded-2xl border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-white/5 p-4 sm:p-5 space-y-4">
     <div><h4 className="text-base font-semibold">{type.label}</h4>
      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{type.hint}</p>
     </div>
     <label className="block text-sm space-y-1"><span className="font-medium">Аудиофайл</span>
      <select value={rule.audioAssetId||''}
       onChange={e=>change(type.id,'audioAssetId',e.target.value||null)}
       className="w-full rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900 p-2.5">
       <option value="">Выберите файл ALARM</option>
       {(data.assets||[]).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
     </label>
     {type.id==='MISSILE_DANGER'&&<label className="block text-sm space-y-1">
      <span className="font-medium">Повторения</span>
      <select value={reps} onChange={e=>change(type.id,'repeats',Number(e.target.value))}
       className="w-full rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900 p-2.5">
       {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}
      </select>
     </label>}
     <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-3 text-xs">
      {asset? <><strong className="block">{asset.name}</strong>
       <span>{reps} {reps===1?'воспроизведение':'воспроизведения'} · примерно {Math.round((asset.durationMs||0)*reps/1000)} сек.</span></>
       : <span className="text-amber-700 dark:text-amber-300">Файл не выбран</span>}
     </div>
     <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!asset} onClick={()=>preview(type.id)}
       className="rounded-xl border border-slate-300 dark:border-white/20 px-4 py-2 text-sm disabled:opacity-50">
       {playing===type.id?'Остановить прослушивание':'Прослушать'}
      </button>
      <button type="button" disabled={!asset||saving===type.id} onClick={()=>save(type.id)}
       className="rounded-xl bg-violet-600 px-4 py-2 text-sm text-white font-medium disabled:opacity-50">
       {saving===type.id?'Сохранение…':'Сохранить'}
      </button>
     </div>
    </article>;
   })}
  </div>}
 </section>;
}
