import {useCallback,useEffect,useRef,useState} from 'react';

/** Headphone-only monitor of read-only 500ms PCM chunks generated in Worker. */
export default function MchsWorkerSessionMonitor({token}){
 const ref=useRef(null),[active,setActive]=useState(false),[error,setError]=useState('');
 const endpoint=(import.meta.env.VITE_API||'http://localhost:4000/api')+'/safety/worker-lab/session/audio.wav';
 const stop=useCallback(()=>{
  const engine=ref.current;ref.current=null;
  if(engine){engine.controller.abort();for(const source of engine.sources){try{source.stop();}catch{}}
   void engine.context.close().catch(()=>{});}
  setActive(false);
 },[]);
 useEffect(()=>()=>{const e=ref.current;ref.current=null;if(e){e.controller.abort();for(const source of e.sources){try{source.stop();}catch{}}void e.context.close().catch(()=>{});}},[]);
 const start=useCallback(async()=>{
  if(ref.current)return;
  setError('');
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context){setError('Браузер не поддерживает Web Audio');return;}
  const engine={context:new Context(),controller:new AbortController(),sources:new Set()};
  ref.current=engine;setActive(true);
  try{await engine.context.resume();}catch(e){setError(e.message);stop();return;}
  let nextTime=engine.context.currentTime+0.12;
  const run=async()=>{
   while(ref.current===engine&&!engine.controller.signal.aborted){
    try{
     const response=await fetch(endpoint,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:engine.controller.signal});
     if(!response.ok)throw new Error('Worker audio HTTP '+response.status);
     const bytes=await response.arrayBuffer();
     if(bytes.byteLength!==24044)throw new Error('Некорректный лабораторный PCM');
     const audio=await engine.context.decodeAudioData(bytes);
     if(ref.current!==engine)break;
     // Schedule a short distance ahead; no accumulated queue after a slow network response.
     nextTime=Math.max(nextTime,engine.context.currentTime+0.03);
     if(nextTime-engine.context.currentTime>0.65)nextTime=engine.context.currentTime+0.03;
     const source=engine.context.createBufferSource();source.buffer=audio;
     source.connect(engine.context.destination);
     engine.sources.add(source);source.onended=()=>engine.sources.delete(source);
     source.start(nextTime);nextTime+=audio.duration;
     // Each request is paced by the amount of buffered sound, not a detached timer.
     const delay=Math.max(0,(nextTime-engine.context.currentTime-0.13)*1000);
     await new Promise(resolve=>setTimeout(resolve,delay));
    }catch(err){
     if(engine.controller.signal.aborted)break;
     setError(err.message||'Звук лаборатории недоступен');stop();break;
    }
   }
  };
  void run();
 },[endpoint,token,stop]);
 return <div className="rounded-xl border border-slate-200 dark:border-white/20 p-3 space-y-2">
  <h5 className="text-sm font-semibold">Монитор серверной PCM-сессии — только наушники</h5>
  <p className="text-xs text-slate-600 dark:text-slate-300">Worker генерирует отдельные PCM-фрагменты по текущему серверному состоянию. Монитор не подключён к эфирному кодеру и может иметь короткие паузы между фрагментами.</p>
  <div className="flex gap-2 flex-wrap">
   <button type="button" disabled={active} onClick={()=>void start()} className="rounded-lg bg-violet-600 text-white px-3 py-2 text-sm disabled:opacity-40">Слушать Worker</button>
   <button type="button" disabled={!active} onClick={stop} className="rounded-lg border border-red-500 px-3 py-2 text-sm disabled:opacity-40">Остановить монитор</button>
  </div>
  {error&&<p role="alert" className="text-red-600 dark:text-red-300 text-xs">{error}</p>}
  <p role="status" className="text-xs">{active?'Монитор активен':'Монитор остановлен'}</p>
 </div>;
}