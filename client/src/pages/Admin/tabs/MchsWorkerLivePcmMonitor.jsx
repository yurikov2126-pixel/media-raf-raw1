import {useCallback,useEffect,useRef,useState} from 'react';

const processorSource=`
class MchsLabSink extends AudioWorkletProcessor {
 constructor(){
  super();this.queue=[];this.offset=0;this.count=0;this.underruns=0;this.dropped=0;this.started=false;this.frames=0;this.target=1440;this.stableFrames=0;this.lastRecovery=0;
  this.port.onmessage=event=>{
   const m=event.data;
   if(m?.reset){this.queue=[];this.offset=0;this.count=0;this.started=false;this.stableFrames=0;return;}
   if(m?.samples){
    const samples=m.samples;
    // Drop old samples, not recent alerts, if the browser stalls.
    while(this.queue.length&&this.count+samples.length>7200){
     this.count-=this.queue[0].length-this.offset;this.queue.shift();this.offset=0;this.dropped++;
    }
    if(samples.length<=7200){this.queue.push(samples);this.count+=samples.length;}
   }
  };
 }
 process(_inputs,outputs){
  const out=outputs[0]?.[0];if(!out)return true;
  if(!this.started&&this.count>=this.target){this.started=true;this.stableFrames=0;}
  for(let i=0;i<out.length;i++){
   let value=0;
   if(this.started&&this.queue.length){
    const head=this.queue[0];value=head[this.offset++]||0;this.count--;
    if(this.offset===head.length){this.queue.shift();this.offset=0;}
   }else if(this.started){this.underruns++;this.started=false;this.stableFrames=0;this.target=Math.min(4320,this.target+480);}
   out[i]=value;
  }
  if(this.started){this.stableFrames+=out.length;if(this.stableFrames>=240000){this.target=Math.max(1440,this.target-240);this.stableFrames=0;}}
  this.frames+=out.length;
  if(this.frames>=24000){this.frames=0;this.port.postMessage({metrics:true,bufferMs:Math.round(this.count*1000/sampleRate),underruns:this.underruns,dropped:this.dropped,targetMs:Math.round(this.target*1000/sampleRate)});}
  return true;
 }
}
registerProcessor('mchs-lab-sink',MchsLabSink);
`;

export default function MchsWorkerLivePcmMonitor({token,phase,revision}){
 const current=useRef(null);
 const [active,setActive]=useState(false),[error,setError]=useState('');
 const [stats,setStats]=useState({bufferMs:0,underruns:0,dropped:0,reconnects:0,targetMs:60});
 const endpoint=(import.meta.env.VITE_API||'http://localhost:4000/api')+'/safety/worker-lab/session/stream.pcm';
 const dispose=useCallback(()=>{
  const engine=current.current;current.current=null;
  if(engine){
   engine.controller.abort();
   engine.node.port.postMessage({reset:true});
   engine.node.disconnect();
   void engine.context.close().catch(()=>{});
   URL.revokeObjectURL(engine.moduleUrl);
  }
  setActive(false);
 },[]);
 useEffect(()=>()=>{const e=current.current;current.current=null;
  if(e){e.controller.abort();e.node.port.postMessage({reset:true});e.node.disconnect();void e.context.close().catch(()=>{});URL.revokeObjectURL(e.moduleUrl);}
 },[]);
 // Commands in this control panel invalidate queued audio immediately. Never let old
 // programme samples continue following a confirmed STOP/INTERRUPT.
 useEffect(()=>{current.current?.node.port.postMessage({reset:true});},[phase,revision]);
 const start=useCallback(async()=>{
  if(current.current)return;
  setError('');setStats({bufferMs:0,underruns:0,dropped:0,reconnects:0});
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context||!window.AudioWorkletNode){setError('AudioWorklet недоступен в браузере');return;}
  let context,moduleUrl;
  try{
   context=new Context({sampleRate:24000});
   if(context.sampleRate!==24000)throw new Error('Аудиоустройство не поддерживает 24 кГц');
   moduleUrl=URL.createObjectURL(new Blob([processorSource],{type:'text/javascript'}));
   await context.audioWorklet.addModule(moduleUrl);
   const node=new AudioWorkletNode(context,'mchs-lab-sink',{outputChannelCount:[1]});
   node.connect(context.destination);
   await context.resume();
   const controller=new AbortController();
   const engine={context,node,moduleUrl,controller};
   current.current=engine;setActive(true);
   node.port.onmessage=e=>{if(e.data?.metrics&&current.current===engine)
    setStats(prev=>({...prev,bufferMs:e.data.bufferMs,underruns:e.data.underruns,dropped:e.data.dropped,targetMs:e.data.targetMs}));};
   let attempts=0;
   while(current.current===engine&&!controller.signal.aborted){
    try{
     const response=await fetch(endpoint,{headers:{Authorization:'Bearer '+token},signal:controller.signal,cache:'no-store'});
     if(!response.ok||!response.body)throw new Error('PCM HTTP '+response.status);
     attempts=0;
     const reader=response.body.getReader();
     let carry=new Uint8Array(0);
     while(current.current===engine&&!controller.signal.aborted){
      const {done,value}=await reader.read();if(done)break;
      const merged=new Uint8Array(carry.length+value.length);merged.set(carry);merged.set(value,carry.length);
      const count=merged.length>>1;
      const data=new DataView(merged.buffer,merged.byteOffset,merged.byteLength);
      // Keep each message short enough to avoid blocking the audio thread.
      for(let start=0;start<count;start+=480){
       const size=Math.min(480,count-start),samples=new Float32Array(size);
       for(let i=0;i<size;i++)samples[i]=data.getInt16((start+i)*2,true)/32768;
       node.port.postMessage({samples},[samples.buffer]);
      }
      carry=merged.slice(count*2);
     }
     if(controller.signal.aborted)break;
     // Worker closes a laboratory stream after 60 seconds; reconnect deliberately.
     node.port.postMessage({reset:true});
     attempts++;if(attempts>3)throw new Error('Не удалось восстановить поток');
     setStats(prev=>({...prev,reconnects:prev.reconnects+1}));
     await new Promise(resolve=>setTimeout(resolve,750));
    }catch(err){
     if(controller.signal.aborted)break;
     attempts++;
     if(attempts>3){setError(err.message||'PCM-поток недоступен');break;}
     node.port.postMessage({reset:true});
     setStats(prev=>({...prev,reconnects:prev.reconnects+1}));
     await new Promise(resolve=>setTimeout(resolve,1000));
    }
   }
   if(current.current===engine)dispose();
  }catch(err){
   if(err.name!=='AbortError')setError(err.message||'Не удалось запустить поток');
   if(current.current)dispose();
   else{if(context)void context.close().catch(()=>{});if(moduleUrl)URL.revokeObjectURL(moduleUrl);}
  }
 },[endpoint,token,dispose]);
 return <div className="rounded-xl border border-slate-200 dark:border-white/20 p-3 space-y-2">
  <h5 className="font-semibold text-sm">Непрерывный лабораторный PCM — наушники</h5>
  <p className="text-xs text-slate-600 dark:text-slate-300">Экспериментальный AudioWorklet-монитор. Ограничение буфера 300 мс, адаптивный стартовый запас 60–180 мс и ограниченное восстановление соединения. Не использовать для настоящих оповещений.</p>
  <div className="flex flex-wrap gap-2">
   <button type="button" disabled={active} onClick={()=>void start()} className="bg-violet-600 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-40">Слушать поток PCM</button>
   <button type="button" disabled={!active} onClick={dispose} className="rounded-lg border border-red-500 px-3 py-2 text-sm disabled:opacity-40">Остановить поток</button>
  </div>
  <p role="status" className="text-xs">{active?'PCM-монитор активен':'PCM-монитор отключён'}</p>
  {active&&<p className="text-xs text-slate-600 dark:text-slate-300">Буфер: {stats.bufferMs} мс · Цель: {stats.targetMs} мс · События нехватки данных: {stats.underruns} · Сброшено чанков: {stats.dropped} · Переподключений: {stats.reconnects}</p>}
  {error&&<p role="alert" className="text-xs text-red-600 dark:text-red-300">{error}</p>}
 </div>;
}
