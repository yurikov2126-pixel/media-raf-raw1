import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from '../../../api/client.js';

const labels={
 WORKER_READ_PROBE_FAILED:'Radio Worker недоступен',
 AGENT_HEARTBEAT_NOT_CURRENT:'Нет свежего heartbeat Windows Agent',
 AGENT_OBSERVER_UNAVAILABLE:'Нет свежего отчёта наблюдателя',
 HALT_RECEIPT_MISSING_OR_STALE:'HALT ACK отсутствует или устарел'
};
export default function MchsConnectionRecoveryTrial({token}){
 const [state,setState]=useState({samples:[],error:'',busy:false});
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const sample=useCallback(async()=>{
  setState(s=>({...s,busy:true,error:''}));
  try{
   const result=await api('/safety/missile-integration-probe',{token});
   if(!mounted.current)return;
   const now=Date.now();
   const entry={at:now,status:result.status,holds:Array.isArray(result.holds)?result.holds:[],
    worker:result.worker?.readProbeOk===true,agent:result.agent?.heartbeatCurrent===true,
    observer:result.agent?.observerFresh===true,halt:result.halt?.receiptCurrent===true};
   setState(s=>({...s,samples:[...s.samples,entry].slice(-20),busy:false}));
  }catch(e){if(mounted.current)setState(s=>({...s,error:e.message||'Ошибка чтения',busy:false,
   samples:[...s.samples,{at:Date.now(),status:'PROBE_FAILED',holds:['WORKER_READ_PROBE_FAILED'],
    worker:false,agent:false,observer:false,halt:false}].slice(-20)}));}
 },[token]);
 const samples=state.samples;
 const sawDown=samples.some(x=>!x.worker||!x.agent);
 const downIndex=samples.findIndex(x=>!x.worker||!x.agent);
 const recovered=downIndex>=0&&samples.slice(downIndex+1).some(x=>x.worker&&x.agent);
 return <section className="mchs-panel rounded-2xl border border-slate-200 dark:border-white/15 p-4 sm:p-5 space-y-3">
  <div className="flex flex-wrap justify-between gap-3 items-start">
   <div><h3 className="font-semibold">Испытание восстановления связи</h3>
    <p className="text-sm opacity-75">Только чтение Worker и телеметрии Agent. Ни одна кнопка не запускает ALARM и не управляет звуком.</p></div>
   <button type="button" onClick={sample} disabled={state.busy}
    className="rounded-xl px-4 py-2 bg-violet-600 text-white disabled:opacity-50">{state.busy?'Проверка…':'Снять показания'}</button>
  </div>
  <p className="text-xs opacity-75">Перед испытанием физически отсоедините аудиокабель усилителя. Сначала снимите исходные показания, затем отключите сеть на тестовом Windows Agent и проверьте повторно. После восстановления связи сделайте третью проверку. Действия с сетью выполняются оператором вручную.</p>
  {state.error&&<p role="alert" className="text-red-700 dark:text-red-300 text-sm">{state.error}</p>}
  <div className="flex flex-wrap gap-2 text-sm">
   <span className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2">Снимков: {samples.length}</span>
   <span className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2">Разрыв: {sawDown?'Наблюдался':'Не зафиксирован'}</span>
   <span className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2">Восстановление: {recovered?'Наблюдалось':'Не подтверждено'}</span>
  </div>
  {samples.length>0&&<ol className="space-y-2 max-h-80 overflow-y-auto">
   {samples.map((s,i)=><li key={s.at+'-'+i} className="rounded-xl border border-slate-200 dark:border-white/15 p-3 text-sm">
    <strong>{new Date(s.at).toLocaleTimeString('ru-RU')} · {s.status}</strong>
    <p className="mt-1 opacity-75">Worker: {s.worker?'Доступен':'Нет данных'} · Agent: {s.agent?'На связи':'Нет связи'} · Наблюдатель: {s.observer?'Свежий':'Нет подтверждения'} · HALT ACK: {s.halt?'Актуален':'Нет подтверждения'}</p>
    {s.holds.length>0&&<p className="text-xs mt-1 opacity-75">{s.holds.map(x=>labels[x]||x).join(' · ')}</p>}
   </li>)}
  </ol>}
  <p className="text-xs opacity-70">История хранится только на текущем экране и исчезает после закрытия страницы. Восстановление связи не подтверждает остановку звука, отсутствие повторного ALARM или состояние усилителя.</p>
 </section>;
}
