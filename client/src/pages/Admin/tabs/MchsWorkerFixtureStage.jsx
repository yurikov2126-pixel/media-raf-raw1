import {useState} from 'react';
/** Explicitly isolated fixture staging: no connection to streaming outputs. */
export default function MchsWorkerFixtureStage({token}){
 const [files,setFiles]=useState({music:null,trainingVoice:null}),[status,setStatus]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const root=(import.meta.env.VITE_API||'http://localhost:4000/api')+'/safety/worker-lab/fixtures';
 const refresh=async()=>{
  const r=await fetch(root,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  if(!r.ok)throw new Error('Статус файлов: HTTP '+r.status);
  setStatus(await r.json());
 };
 const convert=async file=>{
  if(!file||file.size>40*1024*1024)throw new Error('Исходный файл не должен превышать 40 МБ');
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)throw new Error('Web Audio недоступен');
  const context=new Context();
  let decoded;
  try{decoded=await context.decodeAudioData(await file.arrayBuffer());}
  finally{await context.close();}
  if(decoded.duration>10||decoded.duration<0.1)throw new Error('Для серверной лаборатории требуется фрагмент от 0,1 до 10 секунд');
  const frames=Math.ceil(decoded.duration*24000);
  const offline=new OfflineAudioContext(1,frames,24000);
  const source=offline.createBufferSource();source.buffer=decoded;
  source.connect(offline.destination);source.start();
  const result=await offline.startRendering();
  const pcm=result.getChannelData(0);
  const buffer=new ArrayBuffer(44+pcm.length*2),view=new DataView(buffer);
  const write=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
  write(0,'RIFF');view.setUint32(4,buffer.byteLength-8,true);write(8,'WAVEfmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,24000,true);view.setUint32(28,48000,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);
  write(36,'data');view.setUint32(40,pcm.length*2,true);
  for(let i=0;i<pcm.length;i++)view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,pcm[i]))*32767),true);
  return buffer;
 };
 const upload=async kind=>{
  setBusy(true);setError('');
  try{
   const buffer=await convert(files[kind]);
   const res=await fetch(root+'/'+kind,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'audio/wav'},body:buffer});
   if(!res.ok)throw new Error('Загрузка отклонена: HTTP '+res.status);
   await refresh();
  }catch(e){setError(e.message||'Ошибка');}finally{setBusy(false);}
 };
 const clear=async()=>{
  setBusy(true);setError('');
  try{const res=await fetch(root,{method:'DELETE',headers:{Authorization:'Bearer '+token}});
   if(!res.ok)throw new Error('Не удалось очистить лабораторию');
   await refresh();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <div className="rounded-xl border border-slate-300 dark:border-white/20 p-4 space-y-3">
  <h4 className="font-semibold">Подготовка серверных учебных записей — изолированная память Worker</h4>
  <p className="text-sm text-slate-600 dark:text-slate-300">Выберите короткие учебные отрывки до 10 секунд: они преобразуются в PCM16 24 кГц mono и временно передаются Worker. После подготовки файлы используются исключительно непрерывным лабораторным PCM-монитором. Музыка зацикливается, учебный голос воспроизводится один раз, затем наступает тишина до RESUME. К настоящему радиоэфиру файлы НЕ подключены. Не используйте реальный сигнал тревоги или персональные записи.</p>
  {['music','trainingVoice'].map(kind=><div key={kind} className="flex flex-wrap gap-2 items-center">
   <label className="text-sm">{kind==='music'?'Музыкальный отрывок':'Учебный голос'}
    <input className="block text-sm" type="file" accept="audio/*" disabled={busy} onChange={e=>setFiles(old=>({...old,[kind]:e.target.files?.[0]||null}))}/>
   </label>
   <button type="button" disabled={busy||!files[kind]} onClick={()=>void upload(kind)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Подготовить в Worker</button>
   <span className="text-xs">{status?.[kind]?Math.round(status[kind].seconds*10)/10+' с в памяти':'Не загружено'}</span>
  </div>)}
  <div className="flex gap-2 flex-wrap">
   <button type="button" onClick={()=>void refresh().catch(e=>setError(e.message))} disabled={busy} className="rounded-lg border px-3 py-2 text-sm">Обновить статус</button>
   <button type="button" onClick={()=>void clear()} disabled={busy} className="rounded-lg border border-red-500 px-3 py-2 text-sm">Очистить файлы Worker</button>
  </div>
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  <p className="text-xs">Данные хранятся только в оперативной памяти Worker и исчезают при перезапуске. Для проверки откройте «Непрерывный лабораторный PCM», запустите прослушивание, затем START → INTERRUPT → RESUME → STOP. Не включайте оба монитора одновременно.</p>
 </div>;
}