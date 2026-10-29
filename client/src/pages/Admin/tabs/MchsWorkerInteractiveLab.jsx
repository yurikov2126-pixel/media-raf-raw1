import {useCallback,useEffect,useRef,useState} from 'react';

/** Browser-only interactive mixer. All PCM comes from Worker laboratory WAV.
 * No control requests, PCM writes or station encoder connections.
 */
export default function MchsWorkerInteractiveLab({token,stopOtherPreview}){
 const engine=useRef(null),[phase,setPhase]=useState('IDLE'),[error,setError]=useState('');
 const cleanup=useCallback(()=>{
  const e=engine.current;engine.current=null;
  if(e){for(const source of [e.program,e.cue]){try{source?.stop();}catch{}}void e.context.close().catch(()=>{});}
  setPhase('IDLE');
 },[]);
 useEffect(()=>()=>{const e=engine.current;engine.current=null;if(e){for(const source of [e.program,e.cue]){try{source?.stop();}catch{}}void e.context.close().catch(()=>{});}},[]);
 const begin=useCallback(async()=>{
  cleanup();setError('');setPhase('LOADING');
  let context;
  try{
   stopOtherPreview?.();
   const root=import.meta.env.VITE_API||'http://localhost:4000/api';
   const response=await fetch(root+'/safety/worker-lab/handover.wav?scenario=resume',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
   if(!response.ok)throw new Error('Worker WAV недоступен: HTTP '+response.status);
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength>750000||bytes.byteLength<44)throw new Error('Некорректный объём WAV');
   const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
   if(!AudioContextCtor)throw new Error('Web Audio не поддерживается');
   context=new AudioContextCtor();
   const decoded=await context.decodeAudioData(bytes);
   const crop=(a,b)=>{
    const start=Math.floor(a*decoded.sampleRate),end=Math.floor(b*decoded.sampleRate);
    const buffer=context.createBuffer(decoded.numberOfChannels,end-start,decoded.sampleRate);
    for(let ch=0;ch<decoded.numberOfChannels;ch++)buffer.copyToChannel(decoded.getChannelData(ch).subarray(start,end),ch);
    return buffer;
   };
   const programmeBuffer=crop(0.2,1.7),cueBuffer=crop(2.2,3.7);
   const program=context.createBufferSource(),cue=context.createBufferSource();
   const programGain=context.createGain(),cueGain=context.createGain();
   program.buffer=programmeBuffer;program.loop=true;cue.buffer=cueBuffer;cue.loop=true;
   programGain.gain.value=0.65;cueGain.gain.value=0;
   program.connect(programGain).connect(context.destination);
   cue.connect(cueGain).connect(context.destination);
   await context.resume();
   program.start();cue.start();
   engine.current={context,program,cue,programGain,cueGain};
   setPhase('PROGRAM');
  }catch(err){if(context)void context.close().catch(()=>{});setPhase('IDLE');setError(err.message||'Не удалось запустить лабораторию');}
 },[cleanup,stopOtherPreview,token]);
 const switchTo=useCallback(target=>{
  const e=engine.current;if(!e)return;
  const now=e.context.currentTime;
  for(const gain of [e.programGain.gain,e.cueGain.gain]){
   gain.cancelScheduledValues(now);gain.setValueAtTime(gain.value,now);
  }
  e.programGain.gain.linearRampToValueAtTime(target==='PROGRAM'?0.65:0,now+0.12);
  e.cueGain.gain.linearRampToValueAtTime(target==='ALERT'?0.8:0,now+0.12);
  setPhase(target);
 },[]);
 return <div className="rounded-xl border border-slate-200 p-4 space-y-3 dark:border-white/15">
  <h4 className="font-semibold">Интерактивная аудиолаборатория Worker</h4>
  <p className="text-sm text-slate-600 dark:text-slate-300">PCM берётся из тестового WAV Radio Worker. Кнопки управляют только Web Audio в этом браузере. Не являются командами МЧС и не переключают настоящий эфир.</p>
  <p className="text-sm" role="status">Состояние: {({IDLE:'остановлено',LOADING:'загрузка',PROGRAM:'учебная программа',ALERT:'учебное прерывание'})[phase]}</p>
  <div className="flex flex-wrap gap-2">
   <button type="button" disabled={phase!=='IDLE'} onClick={()=>void begin()} className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white disabled:opacity-50">Запустить подложку</button>
   <button type="button" disabled={phase!=='PROGRAM'} onClick={()=>switchTo('ALERT')} className="rounded-lg bg-amber-600 px-3 py-2 text-sm text-white disabled:opacity-50">Прервать</button>
   <button type="button" disabled={phase!=='ALERT'} onClick={()=>switchTo('PROGRAM')} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50">Вернуть музыку</button>
   <button type="button" disabled={phase==='IDLE'} onClick={cleanup} className="rounded-lg border border-red-400 px-3 py-2 text-sm dark:border-red-500">STOP ALL</button>
  </div>
  {error&&<p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
  <p className="text-xs text-slate-600 dark:text-slate-300">Обязательно физически изолированные наушники. Для прекращения звука нажмите STOP ALL; при закрытии панели аудиоконтекст освобождается.</p>
 </div>;
}
