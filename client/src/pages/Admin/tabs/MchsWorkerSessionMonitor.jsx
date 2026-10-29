import {useCallback,useEffect,useRef,useState} from 'react';

/** Browser-only headphone monitor; all PCM comes from the isolated Worker WAV endpoint. */
export default function MchsWorkerSessionMonitor({token,phase,revision}){
 const engineRef=useRef(null);
 const [active,setActive]=useState(false),[error,setError]=useState('');
 const [metrics,setMetrics]=useState({queuedMs:0,underruns:0,fetchMs:0});
 const endpoint=(import.meta.env.VITE_API||'http://localhost:4000/api')+'/safety/worker-lab/session/audio.wav';
 const clearAudio=useCallback(engine=>{
  engine.nextTime=engine.context.currentTime+0.025;
  engine.generation++;
  engine.request?.abort();
  for(const source of engine.sources){try{source.stop();}catch{}}
  engine.sources.clear();
  engine.wake?.();engine.wake=null;
 },[]);
 const stop=useCallback(()=>{
  const engine=engineRef.current;engineRef.current=null;
  if(engine){
   engine.stopped=true;
   clearAudio(engine);
   void engine.context.close().catch(()=>{});
  }
  setActive(false);
  setMetrics({queuedMs:0,underruns:0,fetchMs:0});
 },[clearAudio]);
 useEffect(()=>()=>{const engine=engineRef.current;engineRef.current=null;
  if(engine){engine.stopped=true;clearAudio(engine);void engine.context.close().catch(()=>{});}
 },[clearAudio]);
 // A confirmed server transition clears already queued sound instead of playing stale PCM.
 useEffect(()=>{
  const engine=engineRef.current;
  if(!engine)return;
  clearAudio(engine);
  if(phase==='IDLE')setMetrics(prev=>({...prev,queuedMs:0}));
 },[phase,revision,clearAudio]);
 const start=useCallback(async()=>{
  if(engineRef.current)return;
  setError('');
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context){setError('Браузер не поддерживает Web Audio');return;}
  const engine={context:new Context(),sources:new Set(),request:null,wake:null,generation:0,
   nextTime:0,stopped:false,underruns:0};
  engineRef.current=engine;setActive(true);
  try{await engine.context.resume();}
  catch(err){setError(err.message||'AudioContext недоступен');stop();return;}
  engine.nextTime=engine.context.currentTime+0.04;
  const run=async()=>{
   while(engineRef.current===engine&&!engine.stopped){
    const generation=engine.generation;
    const request=new AbortController();engine.request=request;
    try{
     const started=performance.now();
     const response=await fetch(endpoint,{headers:{Authorization:'Bearer '+token},
      cache:'no-store',signal:request.signal});
     if(!response.ok)throw new Error('Worker audio HTTP '+response.status);
     const bytes=await response.arrayBuffer();
     if(bytes.byteLength!==24044)throw new Error('Некорректный лабораторный PCM');
     const audio=await engine.context.decodeAudioData(bytes);
     if(engine.stopped||engineRef.current!==engine||generation!==engine.generation)continue;
     const now=engine.context.currentTime;
     if(engine.nextTime<now){engine.underruns++;engine.nextTime=now+0.025;}
     // Never accumulate old chunks beyond one fragment of latency.
     if(engine.nextTime-now>0.55){engine.nextTime=now+0.025;}
     const source=engine.context.createBufferSource();
     source.buffer=audio;source.connect(engine.context.destination);
     engine.sources.add(source);source.onended=()=>engine.sources.delete(source);
     source.start(engine.nextTime);
     engine.nextTime+=audio.duration;
     setMetrics({queuedMs:Math.round(Math.max(0,engine.nextTime-now)*1000),
      underruns:engine.underruns,fetchMs:Math.round(performance.now()-started)});
     // Refill just before the queued sound runs out, with an interruptible wait.
     const delay=Math.max(0,(engine.nextTime-engine.context.currentTime-0.18)*1000);
     if(delay>0)await new Promise(resolve=>{
      const timer=setTimeout(()=>{engine.wake=null;resolve();},delay);
      engine.wake=()=>{clearTimeout(timer);resolve();};
     });
    }catch(err){
     if(request.signal.aborted||generation!==engine.generation)continue;
     if(engine.stopped)break;
     setError(err.message||'Звук лаборатории недоступен');
     stop();break;
    }finally{if(engine.request===request)engine.request=null;}
   }
  };
  void run();
 },[endpoint,token,stop]);
 return <div className="rounded-xl border border-slate-200 dark:border-white/20 p-3 space-y-2">
  <h5 className="text-sm font-semibold">Монитор серверной PCM-сессии — только наушники</h5>
  <p className="text-xs text-slate-600 dark:text-slate-300">Изолированный PCM из Radio Worker. При смене серверного состояния накопленный звук сбрасывается. Это всё ещё последовательные WAV-фрагменты по 500 мс, не настоящий low-latency stream.</p>
  <div className="flex gap-2 flex-wrap">
   <button type="button" disabled={active} onClick={()=>void start()} className="rounded-lg bg-violet-600 text-white px-3 py-2 text-sm disabled:opacity-40">Слушать Worker</button>
   <button type="button" disabled={!active} onClick={stop} className="rounded-lg border border-red-500 px-3 py-2 text-sm disabled:opacity-40">Остановить монитор</button>
  </div>
  <p role="status" className="text-xs">{active?'Монитор активен':'Монитор остановлен'}</p>
  {active&&<p className="text-xs text-slate-600 dark:text-slate-300">Буфер: ~{metrics.queuedMs} мс · Паузы: {metrics.underruns} · Загрузка: {metrics.fetchMs} мс</p>}
  {error&&<p role="alert" className="text-red-600 dark:text-red-300 text-xs">{error}</p>}
 </div>;
}
