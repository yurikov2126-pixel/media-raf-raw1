import {useEffect,useRef,useState} from 'react';

const processorSource=`
class MchsLabSink extends AudioWorkletProcessor {
 constructor(){super();this.queue=[];this.offset=0;this.sampleCount=0;this.port.onmessage=e=>{
  if(e.data?.reset){this.queue=[];this.offset=0;this.sampleCount=0;}
  else if(e.data?.samples){if(this.sampleCount<24000){this.queue.push(e.data.samples);this.sampleCount+=e.data.samples.length;}}
 };}
 process(_inputs,outputs){
  const output=outputs[0]?.[0];if(!output)return true;
  for(let i=0;i<output.length;i++){
   let value=0;
   if(this.queue.length){
    const head=this.queue[0];value=head[this.offset++]||0;this.sampleCount--;
    if(this.offset>=head.length){this.queue.shift();this.offset=0;}
   }
   output[i]=value;
  }
  return true;
 }
}
registerProcessor('mchs-lab-sink',MchsLabSink);
`;
export default function MchsWorkerLivePcmMonitor({token}){
 const engineRef=useRef(null);
 const [active,setActive]=useState(false),[error,setError]=useState('');
 const stop=()=>{
  const e=engineRef.current;engineRef.current=null;
  if(e){e.controller.abort();e.node.port.postMessage({reset:true});e.node.disconnect();void e.context.close().catch(()=>{});URL.revokeObjectURL(e.moduleUrl);}
  setActive(false);
 };
 useEffect(()=>()=>{const e=engineRef.current;engineRef.current=null;if(e){e.controller.abort();e.node.port.postMessage({reset:true});e.node.disconnect();void e.context.close().catch(()=>{});URL.revokeObjectURL(e.moduleUrl);}},[]);
 const start=async()=>{
  if(engineRef.current)return;
  setError('');
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context||!window.AudioWorkletNode){setError('Для непрерывного PCM требуется браузер с AudioWorklet');return;}
  let context,moduleUrl;
  try{
   context=new Context({sampleRate:24000});
   if(context.sampleRate!==24000)throw new Error('Аудиоустройство не поддерживает 24 кГц');
   moduleUrl=URL.createObjectURL(new Blob([processorSource],{type:'text/javascript'}));
   await context.audioWorklet.addModule(moduleUrl);
   const node=new AudioWorkletNode(context,'mchs-lab-sink',{outputChannelCount:[1]});
   const controller=new AbortController();
   node.connect(context.destination);await context.resume();
   const engine={context,moduleUrl,node,controller};engineRef.current=engine;setActive(true);
   const endpoint=(import.meta.env.VITE_API||'http://localhost:4000/api')+'/safety/worker-lab/session/stream.pcm';
   const response=await fetch(endpoint,{headers:{Authorization:'Bearer '+token},signal:controller.signal,cache:'no-store'});
   if(!response.ok||!response.body)throw new Error('Поток PCM недоступен: '+response.status);
   const reader=response.body.getReader();
   let carry=new Uint8Array(0);
   while(engineRef.current===engine&&!controller.signal.aborted){
    const {done,value}=await reader.read();if(done)break;
    const merged=new Uint8Array(carry.length+value.length);merged.set(carry);merged.set(value,carry.length);
    const count=merged.length>>1, samples=new Float32Array(count);
    const view=new DataView(merged.buffer,merged.byteOffset,merged.byteLength);
    for(let i=0;i<count;i++)samples[i]=view.getInt16(i*2,true)/32768;
    carry=merged.slice(count*2);
    node.port.postMessage({samples},[samples.buffer]);
   }
   if(engineRef.current===engine)stop();
  }catch(err){
   if(err.name!=='AbortError')setError(err.message||'Не удалось воспроизвести PCM');
   if(engineRef.current)stop();
   else{if(context)void context.close().catch(()=>{});if(moduleUrl)URL.revokeObjectURL(moduleUrl);}
  }
 };
 return <div className="rounded-xl border border-slate-200 dark:border-white/20 p-3 space-y-2">
  <h5 className="font-semibold text-sm">Непрерывный лабораторный PCM — наушники</h5>
  <p className="text-xs text-slate-600 dark:text-slate-300">Экспериментальный поток 24 кГц, mono PCM16. Worker переключает сигнал по состоянию серверной сессии. При сбое сеть может вызвать тишину или разрыв.</p>
  <div className="flex flex-wrap gap-2">
   <button type="button" disabled={active} onClick={()=>void start()} className="bg-violet-600 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-40">Слушать поток PCM</button>
   <button type="button" disabled={!active} onClick={stop} className="rounded-lg border border-red-500 px-3 py-2 text-sm disabled:opacity-40">Остановить поток</button>
  </div>
  <p role="status" className="text-xs">{active?'PCM-поток подключён':'PCM-поток отключён'}</p>
  {error&&<p role="alert" className="text-xs text-red-600 dark:text-red-300">{error}</p>}
 </div>;
}
