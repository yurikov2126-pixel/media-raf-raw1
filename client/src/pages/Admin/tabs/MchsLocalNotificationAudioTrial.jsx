import {useEffect,useRef,useState} from 'react';
import {api} from '../../../api/client.js';
const BASE=import.meta.env.VITE_API||'http://localhost:4000/api';
/** Explicit operator-armed browser-only audio. Never controls Worker, Agent or PA. */
export default function MchsLocalNotificationAudioTrial({token}){
 const [armed,setArmed]=useState(false),[status,setStatus]=useState('Остановлено'),[error,setError]=useState('');
 const audio=useRef(null),run=useRef(null),seen=useRef(new Set()),queue=useRef([]);
 const armedAt=useRef(0),busy=useRef(false),active=useRef(false),url=useRef(null);
 const stop=()=>{
  active.current=false;run.current=null;queue.current=[];busy.current=false;
  if(audio.current){audio.current.pause();audio.current.removeAttribute('src');audio.current.load();}
  if(url.current){URL.revokeObjectURL(url.current);url.current=null;}
  setArmed(false);setStatus('Остановлено');
 };
 useEffect(()=>()=>{active.current=false;if(audio.current)audio.current.pause();
  if(url.current)URL.revokeObjectURL(url.current);},[]);
 const next=async()=>{
  if(busy.current||!active.current)return;
  const event=queue.current.shift();if(!event)return;
  busy.current=true;
  try{
   const response=await fetch(BASE+'/radio/assets/'+encodeURIComponent(event.audioAssetId)+'/audio',
    {headers:{Authorization:'Bearer '+token}});
   if(!response.ok)throw new Error('Не удалось загрузить ALARM: '+response.status);
   const objectUrl=URL.createObjectURL(await response.blob());
   if(!active.current){URL.revokeObjectURL(objectUrl);busy.current=false;return;}
   url.current=objectUrl;run.current={event,repeatsLeft:event.repeats};
   audio.current.src=objectUrl;audio.current.volume=0.35;
   setStatus((event.eventType==='MISSILE_DANGER'?'Ракетная опасность':'Отбой')+
    ' · повтор 1 из '+event.repeats);
   await audio.current.play();
  }catch(e){setError(e.message||'Воспроизведение заблокировано');busy.current=false;run.current=null;
   if(url.current){URL.revokeObjectURL(url.current);url.current=null;}
   if(active.current)void next();}
 };
 const ended=()=>{
  const r=run.current;if(!r||!active.current)return;
  if(r.repeatsLeft>1){r.repeatsLeft--;const n=r.event.repeats-r.repeatsLeft+1;
   setStatus('ALARM · повтор '+n+' из '+r.event.repeats);audio.current.currentTime=0;
   void audio.current.play().catch(e=>setError(e.message));return;}
  run.current=null;busy.current=false;
  if(url.current){URL.revokeObjectURL(url.current);url.current=null;}
  setStatus('Ожидание новых уведомлений');void next();
 };
 const arm=async()=>{
  if(!window.confirm('ЗВУК ТОЛЬКО В ЭТОМ БРАУЗЕРЕ. Проверьте, что устройство НЕ подключено к усилителю и громкоговорителям. Разрешить автоматическое локальное воспроизведение реальных уведомлений?'))return;
  setError('');seen.current=new Set();queue.current=[];armedAt.current=Date.now();
  active.current=true;setArmed(true);setStatus('Ожидание новых уведомлений');
  try{const r=await api('/safety/missile-local-audio-trial/candidates',{token});
   // Baseline prevents playing notifications received before the operator armed.
   (r.candidates||[]).forEach(e=>seen.current.add(e.eventId));
  }catch(e){setError(e.message);stop();}
 };
 useEffect(()=>{
  if(!armed)return;
  let cancelled=false;
  const poll=async()=>{
   if(!active.current||document.visibilityState!=='visible')return;
   try{
    const r=await api('/safety/missile-local-audio-trial/candidates',{token});
    if(cancelled||!active.current)return;
    for(const e of [...(r.candidates||[])].reverse()){
     if(seen.current.has(e.eventId))continue;
     seen.current.add(e.eventId);
     if(!e.allowed||!e.audioAssetId||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(e.eventType))continue;
     const t=Date.parse(e.receivedAt||'');
     if(!Number.isFinite(t)||t<armedAt.current||Date.now()-t>120000)continue;
     if(e.eventType==='MISSILE_ALL_CLEAR'){
      queue.current=[];if(run.current){audio.current.pause();run.current=null;busy.current=false;
       if(url.current){URL.revokeObjectURL(url.current);url.current=null;}}
     }
     queue.current.push(e);
    }
    if(!busy.current)void next();
   }catch(e){if(!cancelled)setError('Нет подтверждения связи с сервером: '+e.message);}
  };
  const interval=setInterval(()=>void poll(),2000);
  return()=>{cancelled=true;clearInterval(interval);};
 },[armed,token]);
 return <section className="rounded-2xl border border-amber-300/50 p-4 space-y-3">
  <h3 className="font-semibold text-lg">Реальные Android-уведомления — локальный аудиотест</h3>
  <p className="text-sm">Только «Ракетная опасность» и «Отбой». Новые проверенные события автоматически воспроизводят назначенный ALARM <strong>в браузере администратора</strong>. Не в Radio Worker, Windows Agent, публичном потоке или громкоговорителях.</p>
  <p className="text-sm text-amber-700 dark:text-amber-300">До включения проверьте физическое отключение усилителя. Не закрывайте вкладку: воспроизведение и мониторинг работают только пока она открыта. Браузер может блокировать автозвук.</p>
  <audio ref={audio} onEnded={ended} aria-label="Локальный ALARM" />
  <div className="flex flex-wrap gap-2">
   {!armed?<button type="button" onClick={()=>void arm()} className="rounded-lg bg-amber-600 text-white px-4 py-2">Включить локальный аудиотест</button>:
    <button type="button" onClick={stop} className="rounded-lg bg-red-700 text-white px-4 py-2">Немедленно остановить тест</button>}
  </div>
  <p role="status" className="text-sm">Состояние: <strong>{status}</strong></p>
  {error&&<p role="alert" className="text-red-700 dark:text-red-300 text-sm">{error}</p>}
 </section>;
}
