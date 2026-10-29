import {useEffect,useRef,useState} from 'react';

/** Files remain browser-local; no upload and no connection to the station stream. */
export default function MchsFileAudioTest({stopOtherPreview}){
 const [music,setMusic]=useState(null),[voice,setVoice]=useState(null);
 const [phase,setPhase]=useState('IDLE'),[error,setError]=useState('');
 const runtime=useRef(null);
 const cleanup=async()=>{
  const s=runtime.current;runtime.current=null;
  if(!s)return;
  try{s.music.pause();s.voice.pause();}catch{}
  for(const url of s.urls)URL.revokeObjectURL(url);
  try{await s.context.close();}catch{}
 };
 useEffect(()=>()=>{void cleanup();},[]);
 const stop=async()=>{await cleanup();setPhase('IDLE');};
 const start=async()=>{
  await stop();stopOtherPreview?.();setError('');
  if(!music||!voice){setError('Выберите музыкальный файл и отдельное тестовое объявление');return;}
  if(music.size>40*1024*1024||voice.size>40*1024*1024){setError('Максимальный размер каждого файла — 40 МБ');return;}
  let context,urls=[];
  try{
   context=new (window.AudioContext||window.webkitAudioContext)();
   await context.resume();
   const musicUrl=URL.createObjectURL(music),voiceUrl=URL.createObjectURL(voice);urls=[musicUrl,voiceUrl];
   const musicAudio=new Audio(musicUrl),voiceAudio=new Audio(voiceUrl);
   const musicGain=context.createGain(),voiceGain=context.createGain(),master=context.createGain();
   musicGain.gain.value=0.55;voiceGain.gain.value=0;master.gain.value=0.5;
   context.createMediaElementSource(musicAudio).connect(musicGain);
   context.createMediaElementSource(voiceAudio).connect(voiceGain);
   musicGain.connect(master);voiceGain.connect(master);master.connect(context.destination);
   const session={context,music:musicAudio,voice:voiceAudio,musicGain,voiceGain,master,urls};
   runtime.current=session;
   musicAudio.onended=()=>{if(runtime.current===session&&phase!=='EMERGENCY')void stop();};
   voiceAudio.onended=()=>{if(runtime.current===session)restore();};
   await musicAudio.play();
   setPhase('PROGRAM');
  }catch(e){setError(e.message||'Не удалось запустить звук');await cleanup();if(context&&context.state!=='closed')await context.close().catch(()=>{});for(const url of urls)URL.revokeObjectURL(url);setPhase('IDLE');}
 };
 const restore=()=>{
  const s=runtime.current;if(!s)return;
  const t=s.context.currentTime;
  s.voiceGain.gain.cancelScheduledValues(t);s.voiceGain.gain.setValueAtTime(s.voiceGain.gain.value,t);s.voiceGain.gain.linearRampToValueAtTime(0,t+0.15);
  s.musicGain.gain.cancelScheduledValues(t);s.musicGain.gain.setValueAtTime(s.musicGain.gain.value,t);s.musicGain.gain.linearRampToValueAtTime(0.55,t+0.25);
  s.voice.pause();s.voice.currentTime=0;setPhase('PROGRAM');
 };
 const interrupt=async()=>{
  const s=runtime.current;if(!s||phase!=='PROGRAM')return;
  const t=s.context.currentTime;
  try{
   s.voice.currentTime=0;await s.voice.play();
   s.musicGain.gain.cancelScheduledValues(t);s.musicGain.gain.setValueAtTime(s.musicGain.gain.value,t);s.musicGain.gain.linearRampToValueAtTime(0,t+0.15);
   s.voiceGain.gain.cancelScheduledValues(t);s.voiceGain.gain.setValueAtTime(0,t);s.voiceGain.gain.linearRampToValueAtTime(0.8,t+0.15);
   setPhase('EMERGENCY');
  }catch(e){setError('Не удалось воспроизвести объявление: '+e.message);}
 };
 return <div className="rounded-xl border border-slate-200 dark:border-white/15 p-4 space-y-3">
  <h4 className="font-semibold">Локальный тест с музыкальным файлом и объявлением</h4>
  <p className="text-sm text-slate-600 dark:text-slate-300">Выберите два аудиофайла с этого устройства. Они не загружаются на сервер и воспроизводятся только в текущем браузере. Не используйте официальный сигнал тревоги или вводящий в заблуждение текст.</p>
  <div className="grid sm:grid-cols-2 gap-3">
   <label className="text-sm space-y-1">Музыка<input className="block w-full text-sm" type="file" accept="audio/*" disabled={phase!=='IDLE'} onChange={e=>setMusic(e.target.files?.[0]||null)}/></label>
   <label className="text-sm space-y-1">Тестовое голосовое объявление<input className="block w-full text-sm" type="file" accept="audio/*" disabled={phase!=='IDLE'} onChange={e=>setVoice(e.target.files?.[0]||null)}/></label>
  </div>
  <div className="flex flex-wrap gap-2">
   <button type="button" disabled={phase!=='IDLE'} onClick={()=>void start()} className="rounded-lg bg-violet-600 text-white px-3 py-2 text-sm disabled:opacity-40">Запустить музыку</button>
   <button type="button" disabled={phase!=='PROGRAM'} onClick={()=>void interrupt()} className="rounded-lg border border-amber-500 px-3 py-2 text-sm disabled:opacity-40">Прервать объявлением</button>
   <button type="button" disabled={phase!=='EMERGENCY'} onClick={restore} className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2 text-sm disabled:opacity-40">Вернуться к музыке</button>
   <button type="button" onClick={()=>void stop()} className="rounded-lg border border-red-500 text-red-700 dark:text-red-300 px-3 py-2 text-sm">Остановить всё</button>
  </div>
  <p className="text-xs">Состояние: {({IDLE:'остановлено',PROGRAM:'музыка',EMERGENCY:'тестовое объявление'})[phase]}</p>
  {error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  <p className="text-xs text-slate-600 dark:text-slate-300">Проверяйте только с физически изолированными наушниками. Прямой эфир, Radio Worker, усилитель и коридорные громкоговорители не участвуют.</p>
 </div>;
}
