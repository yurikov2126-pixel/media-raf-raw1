import {useCallback,useEffect,useState} from 'react';
import {api} from '../api/client.js';

export default function RadioRotationSettings({token,assets=[]}){
 const [settings,setSettings]=useState(null),[preview,setPreview]=useState(null);
 const [playlist,setPlaylist]=useState(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false);
 const load=useCallback(async()=>{try{setSettings((await api('/radio/rotation',{token})).rotation);setError('');}catch(e){setError(e.message);}},[token]);
 useEffect(()=>{void load();},[load]);
 const loadPlaylist=useCallback(async()=>{
   try{const result=await api('/radio/rotation/assets',{token});setPlaylist(result);}
   catch(e){setPlaylist({error:e.message||'Ошибка загрузки плейлиста',tracks:[]});}
 },[token]);
 useEffect(()=>{
   void loadPlaylist();
   const timer=setInterval(()=>{void loadPlaylist();},15000);
   const onFocus=()=>{void loadPlaylist();};
   window.addEventListener('focus',onFocus);
   return ()=>{clearInterval(timer);window.removeEventListener('focus',onFocus);};
 },[loadPlaylist]);
 const performers=playlist?.tracks||[];
 const missing=performers.filter(a=>!a.artist);
 const save=async e=>{
   e.preventDefault();setSaving(true);setError('');setNotice('');
   try{const x=await api('/radio/rotation',{token,method:'PUT',body:settings});setSettings(x.rotation);setNotice('Правила ротации по исполнителям сохранены.');}
   catch(e){setError(e.message||'Ошибка сохранения');}finally{setSaving(false);}
 };
 if(!settings)return <p className="text-sm opacity-75">{error||'Загрузка правил ротации…'}</p>;
 return <section className="radio-panel space-y-4 rounded-2xl p-4 sm:p-5">
  <div><h3 className="text-lg font-semibold">Музыкальная ротация · Auto-DJ</h3>
   <p className="mt-1 text-sm opacity-80">Разделяем песни одного исполнителя. Исполнитель определяется по полю ID3 Artist, сохранённому при загрузке файла.</p></div>
  <form onSubmit={save} className="space-y-4">
   <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={settings.enabled} className="h-5 w-5 accent-violet-600" onChange={e=>setSettings(v=>({...v,enabled:e.target.checked}))}/>Включить музыкальную ротацию</label>
   <label className="block space-y-1 text-sm"><span className="font-medium">Минимум других композиций между песнями одного исполнителя</span>
    <select className="w-full max-w-sm rounded-xl border border-current/20 p-3" value={settings.artistGap??0} onChange={e=>setSettings(v=>({...v,artistGap:Number(e.target.value)}))}>
     {[0,1,2,3,4,5].map(n=><option key={n} value={n}>{n===0?'Не ограничивать':n+' других комп.'}</option>)}
    </select>
   </label>
   <div className="rounded-xl border border-current/15 p-3 text-sm">
    <strong>Исполнители из ID3</strong>
    <p className="mt-1 opacity-80">{playlist?.error||(!playlist?'Загрузка выбранного плейлиста…':playlist.playlistName?`Плейлист: ${playlist.playlistName} · файлов: ${performers.length} · без исполнителя: ${missing.length}`:'Утверждённый плейлист Auto-DJ не выбран')}. При нехватке разных исполнителей Auto-DJ выбирает максимально возможное разделение, но не исключает песни из эфира.</p>
    <details className="mt-2"><summary className="cursor-pointer font-medium">Просмотреть исполнителей</summary>
     <div className="mt-3 max-h-64 space-y-2 overflow-auto">{performers.map(a=><div key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-current/10 pb-2 text-xs"><span className="min-w-0 break-words">{a.name}</span><span className={a.artist?'font-semibold':'text-amber-600 dark:text-amber-300'}>{a.artist||'ID3 Artist отсутствует'}</span></div>)}</div>
    </details>
   </div>
   <label className="block space-y-1 text-sm">Пауза перед повтором композиции
    <select className="w-full max-w-sm rounded-xl border border-current/20 p-3" value={settings.cooldownMinutes??0} onChange={e=>setSettings(v=>({...v,cooldownMinutes:Number(e.target.value)}))}>
     {[0,15,30,60,90,120,180,240].map(n=><option key={n} value={n}>{n===0?'Без ограничения':n+' мин'}</option>)}
    </select>
   </label>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!settings.cooldownMinutes} checked={settings.strictCooldown??false} onChange={e=>setSettings(v=>({...v,strictCooldown:e.target.checked}))}/>Строгий запрет повтора композиции до окончания паузы</label>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!settings.strictCooldown||!settings.cooldownMinutes} checked={settings.allowCooldownFallback??false} onChange={e=>setSettings(v=>({...v,allowCooldownFallback:e.target.checked}))}/>Разрешить ранний повтор, если очередь исчерпана</label>
   <div className="rounded-xl border border-current/15 p-3">
    <button type="button" className="rounded-lg border border-current/20 px-3 py-2 text-sm" onClick={async()=>{await loadPlaylist();try{setPreview(await api('/radio/rotation/preview',{token}));setError('');}catch(e){setError(e.message);}}}>Предпросмотр музыкальной очереди</button>
    {preview&&<div className="mt-3 space-y-1 text-xs">{preview.tracks?.length?preview.tracks.map((t,i)=><p key={t.id+'-'+i}>{i+1}. {t.artist||'Исполнитель неизвестен'} — {t.name}</p>):<p>Нет утверждённого плейлиста Auto-DJ</p>}<p className="opacity-70">Прогноз. Фактический порядок может изменяться по истории воспроизведения.</p></div>}
   </div>
   {missing.length>0&&<p className="text-xs text-amber-700 dark:text-amber-300">Если ID3 Artist отсутствует, такой файл не объединяется с другими в одного исполнителя. Уточните теги исходной записи.</p>}
   {error&&<p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
   {notice&&<p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
   <button disabled={saving} type="submit" className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?'Сохранение…':'Сохранить ротацию'}</button>
  </form>
 </section>;
}
