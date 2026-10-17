import { useEffect, useRef, useState } from 'react';
const API = import.meta.env.VITE_API || 'http://localhost:4000/api';
const fmt = seconds => { const s = Math.max(0,Math.floor(seconds || 0)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
export default function RadioTrackPlayer({ tracks = [], token, student = false }) {
  const [index,setIndex] = useState(-1);
  const [url,setUrl] = useState('');
  const [playing,setPlaying] = useState(false);
  const [seconds,setSeconds] = useState(0);
  const [duration,setDuration] = useState(0);
  const [error,setError] = useState('');
  const [volume,setVolume] = useState(0.85);
  const audio = useRef(null);
  const loaded = useRef(null);
  const names = tracks.map(t => ({ id:t.id || t.assetId, name:t.name || t.asset?.name || 'Аудиозапись' }));
  const active = names[index];
  useEffect(() => { if(audio.current) audio.current.volume=volume; },[volume]);
  useEffect(() => { setIndex(-1); setPlaying(false); },[student,token]);
  useEffect(() => {
    let cancelled=false;
    const previous=loaded.current; loaded.current=null;
    if(previous) URL.revokeObjectURL(previous);
    setUrl(''); setError(''); setSeconds(0); setDuration(0);
    if(index<0 || !active?.id){audio.current?.pause();setPlaying(false);return;}
    const controller=new AbortController();
    fetch(API+'/radio/'+(student?'student/':'')+'assets/'+encodeURIComponent(active.id)+'/audio',{
      headers:{Authorization:'Bearer '+token},signal:controller.signal,
    }).then(async res=>{if(!res.ok)throw Error('Не удалось открыть аудиозапись');return res.blob();})
      .then(blob=>{if(cancelled)return;const next=URL.createObjectURL(blob);loaded.current=next;setUrl(next);})
      .catch(e=>{if(!cancelled&&e.name!=='AbortError'){setError(e.message);setPlaying(false);}});
    return ()=>{cancelled=true;controller.abort();if(loaded.current){URL.revokeObjectURL(loaded.current);loaded.current=null;}};
  },[index,active?.id,student,token]);
  useEffect(()=>{if(!url||!audio.current)return;audio.current.play().then(()=>setPlaying(true)).catch(()=>setPlaying(false));},[url]);
  const choose=n=>setIndex(n);
  return <div data-no-route-swipe className="space-y-2 rounded-xl border border-current/15 bg-white/5 p-3 text-sm">
    <div className="flex min-w-0 items-center gap-2">
      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-500">♫</span>
      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{active?.name || 'Предпрослушивание плейлиста'}</p>
        <p className="text-xs opacity-60">{index<0?'Выберите композицию':(index+1)+' / '+names.length}</p></div>
    </div>
    <audio ref={audio} src={url||undefined} preload="metadata" onTimeUpdate={e=>setSeconds(e.currentTarget.currentTime)}
      onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} onEnded={()=>index<names.length-1?choose(index+1):setPlaying(false)}/>
    <div className="flex items-center gap-2">
      <button type="button" className="rounded-lg border border-current/20 px-3 py-2 disabled:opacity-40" disabled={index<=0} onClick={()=>choose(index-1)} aria-label="Предыдущий трек">◀◀</button>
      <button type="button" className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-40"
        disabled={!names.length} onClick={()=>{if(index<0){choose(0);return;}if(!audio.current)return;if(playing)audio.current.pause();else audio.current.play().catch(()=>{});setPlaying(!playing);}}>
        {playing?'Пауза':'Слушать'}
      </button>
      <button type="button" className="rounded-lg border border-current/20 px-3 py-2 disabled:opacity-40" disabled={index>=names.length-1} onClick={()=>choose(index<0?0:index+1)} aria-label="Следующий трек">▶▶</button>
      <span className="ml-auto shrink-0 text-xs tabular-nums opacity-70">{fmt(seconds)} / {fmt(duration)}</span>
    </div>
    <input type="range" aria-label="Перемотка трека" min="0" max={Number.isFinite(duration)&&duration>0?duration:1} step="0.1" value={Math.min(seconds,Number.isFinite(duration)&&duration>0?duration:1)}
      onChange={e=>{if(audio.current)audio.current.currentTime=Number(e.target.value);setSeconds(Number(e.target.value));}} className="w-full accent-blue-500"/>
    <label className="flex items-center gap-2 text-xs opacity-75">Громкость <input aria-label="Громкость" className="w-28 accent-blue-500" type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label>
    {error&&<p role="alert" className="text-red-500">{error}</p>}
    <div className="max-h-40 overflow-y-auto space-y-1">
      {names.map((t,i)=><button key={t.id+':'+i} type="button" onClick={()=>choose(i)} className={'w-full truncate rounded-lg px-3 py-2 text-left text-xs '+(i===index?'bg-blue-500/15 text-blue-600 dark:text-blue-300':'hover:bg-white/10')} aria-current={i===index?'true':undefined}>{i+1}. {t.name}</button>)}
    </div>
  </div>;
}
