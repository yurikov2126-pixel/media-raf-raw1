import {useCallback,useEffect,useRef,useState} from 'react';

/** Browser-local isolated mixer; never connects to station Worker or speakers remotely. */
export default function MchsIsolatedMixer({token,stopOtherPreview}){
 const ref=useRef(null),[state,setState]=useState('IDLE'),[error,setError]=useState('');
 const destroy=useCallback(async()=>{
  const s=ref.current;ref.current=null;
  if(s){
   try{s.source?.stop();}catch{}
   try{s.cue?.stop();}catch{}
   s.program?.disconnect();s.emergency?.disconnect();
   if(s.context?.state!=='closed')await s.context.close().catch(()=>{});
  }
  setState('IDLE');
 },[]);
 useEffect(()=>()=>{void destroy();},[destroy]);
 const init=useCallback(async()=>{
  await destroy();stopOtherPreview?.();setError('');
  let ctx;
  try{
   ctx=new (window.AudioContext||window.webkitAudioContext)();
   await ctx.resume();
   const program=ctx.createGain(),emergency=ctx.createGain(),master=ctx.createGain();
   program.gain.value=0.10;emergency.gain.value=0;master.gain.value=0.55;
   program.connect(master);emergency.connect(master);master.connect(ctx.destination);
   // Local synthesized programme. This cannot use the station media stream.
   const osc=ctx.createOscillator();osc.type='triangle';osc.frequency.value=220;
   osc.connect(program);osc.start();
   ref.current={context:ctx,program,emergency,master,source:osc,cue:null,phase:'PROGRAM'};
   setState('PROGRAM');
  }catch(e){if(ctx&&ctx.state!=='closed')await ctx.close().catch(()=>{});setError(e.message||'Невозможно открыть аудиоустройство');setState('IDLE');}
 },[destroy,stopOtherPreview]);
 const interrupt=useCallback(()=>{
  const s=ref.current;if(!s||s.phase!=='PROGRAM')return;
  const {context,program,emergency}=s,t=context.currentTime;
  program.gain.cancelScheduledValues(t);program.gain.setValueAtTime(program.gain.value,t);program.gain.linearRampToValueAtTime(0,t+0.12);
  emergency.gain.setValueAtTime(0,t);emergency.gain.linearRampToValueAtTime(0.13,t+0.12);
  const cue=context.createOscillator();cue.type='sine';cue.frequency.value=740;
  cue.connect(emergency);cue.start(t);s.cue=cue;s.phase='EMERGENCY';setState('EMERGENCY');
 },[]);
 const resume=useCallback(()=>{
  const s=ref.current;if(!s||s.phase!=='EMERGENCY')return;
  const {context,program,emergency}=s,t=context.currentTime;
  emergency.gain.cancelScheduledValues(t);emergency.gain.setValueAtTime(emergency.gain.value,t);
  emergency.gain.linearRampToValueAtTime(0,t+0.12);
  program.gain.cancelScheduledValues(t);program.gain.setValueAtTime(program.gain.value,t);
  program.gain.linearRampToValueAtTime(0.1,t+0.2);
  const old=s.cue;s.cue=null;if(old){old.stop(t+0.13);old.onended=()=>old.disconnect();}
  s.phase='PROGRAM';setState('PROGRAM');
 },[]);
 return <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-3">
  <h4 className="font-semibold">Изолированный микшер — живое переключение</h4>
  <p className="text-sm text-slate-600 dark:text-slate-300">Генерируемая в браузере музыкальная подложка и сигнал переключаются по нажатию кнопок, а не по заранее записанному WAV. Низкая громкость. Используйте только физически изолированные наушники: выход браузера нельзя автоматически отделить от усилителя колледжа.</p>
  <div className="flex flex-wrap gap-2">
   <button type="button" onClick={()=>void init()} className="rounded-lg bg-violet-600 text-white px-3 py-2 text-sm">Запустить подложку</button>
   <button type="button" disabled={state!=='PROGRAM'} onClick={interrupt} className="rounded-lg border border-amber-500 px-3 py-2 text-sm disabled:opacity-40">Тестовое прерывание</button>
   <button type="button" disabled={state!=='EMERGENCY'} onClick={resume} className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2 text-sm disabled:opacity-40">Вернуть музыку</button>
   <button type="button" onClick={()=>void destroy()} className="rounded-lg border border-red-500 text-red-700 dark:text-red-300 px-3 py-2 text-sm">Остановить всё</button>
  </div>
  <p className="text-xs">Состояние: {({IDLE:'остановлено',PROGRAM:'подложка',EMERGENCY:'тестовый сигнал'})[state]}</p>
  {error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  <p className="text-xs text-slate-600 dark:text-slate-300">Не использует Radio Worker, загруженную музыку, МЧС Android, интернет-радио или ESP32. Реальная автоматика оповещений отключена.</p>
 </div>;
}
