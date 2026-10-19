import {useEffect,useRef,useState} from 'react';

const clock=ms=>{const s=Math.max(0,Math.floor((ms||0)/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};

export default function RadioListen(){
 const [status,setStatus]=useState(null),[now,setNow]=useState(Date.now());
 const [playing,setPlaying]=useState(false),[error,setError]=useState('');
 const audio=useRef(null);
 useEffect(()=>{
  let active=true;
  const refresh=async()=>{try{
   const res=await fetch('/api/radio-agent/listen/now-playing',{cache:'no-store'});
   if(!res.ok)throw new Error('Недоступны данные эфира');
   const data=await res.json();if(active)setStatus(data);
  }catch{if(active)setStatus(null);}};
  refresh();const timer=setInterval(refresh,5000);const ticker=setInterval(()=>setNow(Date.now()),1000);
  return()=>{active=false;clearInterval(timer);clearInterval(ticker);};
 },[]);
 const track=status?.track;
 const elapsed=status?.playout?Math.max(0,(status.playout.seekMs||0)+(status.playout.emittedMs||0)):0;
 const total=status?.playout?.durationMs||track?.durationMs||0;
 const percent=total&&status?.playout?Math.min(100,Math.max(0,100*elapsed/total)):0;
 return <main className="min-h-screen bg-slate-950 px-4 py-12 text-white">
  <div className="mx-auto max-w-xl space-y-6">
   <a href="/" className="text-xs tracking-[.2em] text-indigo-300">MEDIA · РАФ · RAW</a>
   <div className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-8">
    <p className="text-xs uppercase tracking-widest text-indigo-300">Прямой эфир · MP3</p>
    <h1 className="mt-4 text-3xl font-bold">Слушать радио</h1>
    <p className="mt-5 text-sm text-slate-400">{status?.available?'Трансляция с центрального радиосервера':'Получаем состояние эфира…'}</p>
    <h2 className="mt-5 text-2xl font-semibold">{status?.mode==='LIVE'?'Ведущий в прямом эфире':status?.mode==='JINGLE'?'Джингл':track?.title||track?.name||'Ожидание музыки'}</h2>
    <p className="mt-2 text-base text-slate-300">{track?.artist||'MEDIA · РАФ · RAW'}</p>
    <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Прогресс записи" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-indigo-400" style={{width:percent+'%'}}/></div>
    <div className="mt-2 flex justify-between text-xs text-slate-400"><span>{status?.playout?clock(elapsed):'—'}</span><span>{total?clock(total):'—'}</span></div>
    <audio ref={audio} controls preload="none" src="/api/radio-agent/listen" className="mt-7 w-full" onPlay={()=>{setPlaying(true);setError('');}} onPause={()=>setPlaying(false)} onError={()=>{setPlaying(false);setError('Не удаётся воспроизвести MP3-поток');}} aria-label="Радио MEDIA РАФ RAW"/>
    <p className="mt-3 text-xs text-slate-400">{playing?'Вы слушаете публичную трансляцию':'Нажмите воспроизведение для прослушивания'} · Информация обновляется каждые 5 секунд</p>
    {error&&<p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
   </div>
   <p className="text-center text-xs text-slate-500">Звук может отставать от названия и прогресса из-за буферизации MP3.</p>
  </div>
 </main>;
}
