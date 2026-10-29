import {useCallback,useEffect,useRef,useState} from 'react';

/** Browser-local real audio fixtures. This never uploads files or touches station routing. */
export default function MchsFileAudioTest({stopOtherPreview}){
 const [music,setMusic]=useState(null),[voice,setVoice]=useState(null);
 const [phase,setPhase]=useState('IDLE'),[error,setError]=useState('');
 const [resumeSeconds,setResumeSeconds]=useState(null);
 const runtime=useRef(null),generation=useRef(0);
 const cleanup=useCallback(()=>{
  generation.current++;
  const s=runtime.current;runtime.current=null;
  if(s){
   s.music.onended=null;s.voice.onended=null;s.music.onerror=null;s.voice.onerror=null;
   try{s.music.pause();s.voice.pause();}catch{}
   for(const url of s.urls)URL.revokeObjectURL(url);
   void s.context.close().catch(()=>{});
  }
  setPhase('IDLE');setResumeSeconds(null);
 },[]);
 useEffect(()=>()=>{generation.current++;const s=runtime.current;runtime.current=null;
  if(s){s.music.pause();s.voice.pause();for(const u of s.urls)URL.revokeObjectURL(u);void s.context.close().catch(()=>{});}
 },[]);
 const start=async()=>{
  cleanup();stopOtherPreview?.();setError('');
  if(!music||!voice){setError('Выберите музыкальный файл и отдельное учебное объявление');return;}
  if(music.size>40*1024*1024||voice.size>40*1024*1024||!music.size||!voice.size){
   setError('Каждый файл должен иметь размер от 1 байта до 40 МБ');return;
  }
  const ticket=++generation.current;let context,urls=[];
  try{
   const Ctor=window.AudioContext||window.webkitAudioContext;
   if(!Ctor)throw new Error('Web Audio не поддерживается');
   context=new Ctor();
   const mu=URL.createObjectURL(music),vo=URL.createObjectURL(voice);urls=[mu,vo];
   const musicAudio=new Audio(mu),voiceAudio=new Audio(vo);
   musicAudio.preload='auto';voiceAudio.preload='auto';
   const musicGain=context.createGain(),voiceGain=context.createGain(),master=context.createGain();
   musicGain.gain.value=0.65;voiceGain.gain.value=0;master.gain.value=0.6;
   context.createMediaElementSource(musicAudio).connect(musicGain);
   context.createMediaElementSource(voiceAudio).connect(voiceGain);
   musicGain.connect(master);voiceGain.connect(master);master.connect(context.destination);
   const s={context,music:musicAudio,voice:voiceAudio,musicGain,voiceGain,urls,phase:'PROGRAM',position:0};
   runtime.current=s;
   musicAudio.onended=()=>{if(runtime.current===s&&s.phase==='PROGRAM')cleanup();};
   musicAudio.onerror=()=>{if(runtime.current===s){setError('Не удалось воспроизвести музыкальный файл');cleanup();}};
   voiceAudio.onended=()=>{if(runtime.current===s)void restore();};
   voiceAudio.onerror=()=>{if(runtime.current===s){setError('Ошибка тестового объявления');void restore();}};
   await context.resume();
   await musicAudio.play();
   if(generation.current!==ticket||runtime.current!==s)return;
   setPhase('PROGRAM');
  }catch(e){
   setError(e.message||'Ошибка запуска локального звука');
   if(runtime.current)cleanup();
   else{if(context)void context.close().catch(()=>{});for(const url of urls)URL.revokeObjectURL(url);}
  }
 };
 const restore=async()=>{
  const s=runtime.current;if(!s||s.phase!=='ALERT')return;
  const t=s.context.currentTime;
  s.voice.pause();s.voice.currentTime=0;
  s.voiceGain.gain.cancelScheduledValues(t);s.voiceGain.gain.setValueAtTime(0,t);
  s.musicGain.gain.cancelScheduledValues(t);
  s.musicGain.gain.setValueAtTime(0,t);
  try{
   s.music.currentTime=s.position;
   await s.music.play();
   if(runtime.current!==s)return;
   s.musicGain.gain.linearRampToValueAtTime(0.65,s.context.currentTime+0.2);
   s.phase='PROGRAM';setPhase('PROGRAM');
  }catch(e){setError('Не удалось вернуть музыку: '+e.message);cleanup();}
 };
 const interrupt=async()=>{
  const s=runtime.current;if(!s||s.phase!=='PROGRAM')return;
  const t=s.context.currentTime;
  s.position=s.music.currentTime;
  s.music.pause();setResumeSeconds(Math.round(s.position*10)/10);
  s.musicGain.gain.cancelScheduledValues(t);s.musicGain.gain.setValueAtTime(0,t);
  s.voice.currentTime=0;
  try{
   s.voiceGain.gain.cancelScheduledValues(t);s.voiceGain.gain.setValueAtTime(0,t);
   await s.voice.play();if(runtime.current!==s)return;
   s.voiceGain.gain.linearRampToValueAtTime(0.8,s.context.currentTime+0.1);
   s.phase='ALERT';setPhase('ALERT');
  }catch(e){
   setError('Не удалось включить учебное объявление: '+e.message);
   s.voiceGain.gain.setValueAtTime(0,s.context.currentTime);
   s.music.currentTime=s.position;
   try{await s.music.play();s.musicGain.gain.setValueAtTime(0.65,s.context.currentTime);}catch{}
  }
 };
 return <div className="rounded-xl border border-slate-200 dark:border-white/15 p-4 space-y-3">
  <h4 className="font-semibold">Изолированный тест с музыкальным файлом и учебным голосом</h4>
  <p className="text-sm text-slate-600 dark:text-slate-300">Два файла выбираются только с вашего устройства. Никаких загрузок на сервер, команд Radio Worker или подключения к коридорным громкоговорителям. Используйте запись с явными словами «Учебная проверка», не официальные сигналы МЧС.</p>
  <div className="grid sm:grid-cols-2 gap-3">
   <label className="text-sm space-y-1">Музыкальный файл<input className="block w-full text-sm" type="file" accept="audio/*" disabled={phase!=='IDLE'} onChange={e=>setMusic(e.target.files?.[0]||null)}/></label>
   <label className="text-sm space-y-1">Учебное объявление<input className="block w-full text-sm" type="file" accept="audio/*" disabled={phase!=='IDLE'} onChange={e=>setVoice(e.target.files?.[0]||null)}/></label>
  </div>
  <div className="flex flex-wrap gap-2">
   <button type="button" disabled={phase!=='IDLE'} onClick={()=>void start()} className="rounded-lg bg-violet-600 text-white px-3 py-2 text-sm disabled:opacity-40">Запустить музыку</button>
   <button type="button" disabled={phase!=='PROGRAM'} onClick={()=>void interrupt()} className="rounded-lg border border-amber-500 px-3 py-2 text-sm disabled:opacity-40">Прервать объявлением</button>
   <button type="button" disabled={phase!=='ALERT'} onClick={()=>void restore()} className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2 text-sm disabled:opacity-40">Вернуться к музыке</button>
   <button type="button" onClick={cleanup} className="rounded-lg border border-red-500 text-red-700 dark:text-red-300 px-3 py-2 text-sm">STOP ALL</button>
  </div>
  <p className="text-xs" role="status">Состояние: {({IDLE:'остановлено',PROGRAM:'музыка',ALERT:'учебное объявление'})[phase]}{resumeSeconds!==null?' · Позиция возобновления музыки: '+resumeSeconds+' с':''}</p>
  {error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  <p className="text-xs text-slate-600 dark:text-slate-300">Проверка только в физически изолированных наушниках. При прерывании музыка ставится на паузу и после учебного объявления продолжается с сохранённой позиции. STOP ALL освобождает аудиоресурсы.</p>
 </div>;
}
