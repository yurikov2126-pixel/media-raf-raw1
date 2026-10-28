import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../api/client.js';

const fmt = value => value ? new Date(value).toLocaleString('ru-RU') : 'Нет данных';
const status = (health,delivery,incidents,queue) => {
 const open=(incidents||[]).filter(x=>!x.resolvedAt);
 const fresh=delivery?.connection==='HEARTBEAT_RECENT';
 const tele=delivery?.vmTelemetry;
 return {
  open, fresh,
  cards:[
   {name:'Технические неисправности',value:incidents?String(open.length):'Нет данных',detail:open.length?'Есть неустранённые записи':'Только техническая диагностика',view:'incidents'},
   {name:'Очередь анализа',value:queue?.pending==null?'Нет данных':String(queue.pending),detail:'Ожидают анализа на сервере',view:'queue'},
   {name:'Android VM',value:fresh?'Heartbeat получен':delivery?.connection==='HEARTBEAT_STALE'?'Heartbeat устарел':'Нет подтверждения',detail:'Последний контакт: '+fmt(delivery?.lastHeartbeatAt),view:'delivery'},
   {name:'Локальные отправки',value:tele?.telemetryFresh&&tele?.queuedLocal!=null?String(tele.queuedLocal):'Нет свежих данных',detail:tele?.telemetryFresh?'Ожидают подтверждения на VM':'Состояние локальной очереди неизвестно',view:'delivery'}
  ]
 };
};
export default function MchsOperationalOverview({token,onOpen}) {
 const [state,setState]=useState({queue:null,delivery:null,incidents:null,messages:null,error:'',updated:null});
 const refresh=useCallback(async()=>{
  try{
   const [queue,delivery,journal,dashboard]=await Promise.all([
    api('/safety/observation-queue?limit=50',{token}),
    api('/safety/delivery-diagnostics',{token}),
    api('/safety/technical-incidents',{token}),
    api('/safety/dashboard',{token})
   ]);
   setState({queue,delivery,incidents:journal.items||[],messages:dashboard.events||[],error:'',updated:new Date()});
  }catch(e){setState(x=>({...x,error:e.message||'Ошибка загрузки'}));}
 },[token]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh();},30000);return()=>clearInterval(timer);},[refresh]);
 const {cards,open}=status(null,state.delivery,state.incidents,state.queue);
 return <section className="mchs-panel rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-4 sm:p-5 space-y-4">
  <div className="flex flex-wrap gap-2 justify-between items-start">
   <div><h3 className="font-semibold text-lg">Оперативная сводка</h3><p className="text-sm text-slate-600 dark:text-slate-300">Техническая диагностика, не подтверждение официальных тревог.</p></div>
   <button type="button" onClick={()=>void refresh()} className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-sm">Обновить сводку</button>
  </div>
  {state.error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}
  <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
   {cards.map(card=><button key={card.name} type="button" onClick={()=>onOpen(card.view)}
    className="rounded-xl border border-slate-200 dark:border-white/15 p-3.5 text-left bg-slate-50 dark:bg-white/5 hover:border-violet-400 transition-colors">
    <span className="block text-xs text-slate-600 dark:text-slate-300">{card.name}</span>
    <strong className="block text-lg mt-1 break-words">{card.value}</strong>
    <span className="block text-xs text-slate-600 dark:text-slate-300 mt-1">{card.detail}</span>
    <span className="block text-xs text-violet-700 dark:text-violet-300 mt-3">Перейти →</span>
   </button>)}
  </div>
  <div className="grid md:grid-cols-2 gap-3">
   <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3">
    <h4 className="font-semibold">Неустранённые неисправности</h4>
    {state.incidents===null?<p className="text-sm mt-2">Загрузка…</p>:open.length===0?<p className="text-sm mt-2">В загруженном журнале нет открытых записей.</p>:
    open.slice(0,3).map(item=><button key={item.id} type="button" onClick={()=>onOpen('incidents',item.id)} className="block w-full mt-2 text-left rounded-lg border border-slate-200 dark:border-white/15 px-3 py-2 text-sm">
      <strong className="block">{item.kind}</strong><span className="text-xs">Начало: {fmt(item.openedAt)}</span>
    </button>)}
   </div>
   <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3">
    <div className="flex items-center justify-between gap-2">
      <h4 className="font-semibold">Журнал сообщений МЧС</h4>
      <button type="button" onClick={()=>onOpen('events')} className="text-xs font-medium text-violet-700 dark:text-violet-300">Весь журнал →</button>
    </div>
    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Последние сохранённые сообщения. Подлинность и полнота получения не подтверждены.</p>
    {state.messages===null?<p className="text-sm mt-2">Загрузка…</p>:state.messages.length===0?<p className="text-sm mt-2">В загруженном журнале нет сообщений.</p>:
      [...state.messages].sort((a,b)=>new Date(b.receivedAt||0)-new Date(a.receivedAt||0)).slice(0,3).map(item=>
        <button key={item.id} type="button" onClick={()=>onOpen('events')}
          className="block w-full text-left rounded-lg border border-slate-200 dark:border-white/15 px-3 py-2 mt-2 text-sm hover:border-violet-400 transition-colors">
          <strong className="block break-words">{item.title||'Без заголовка'}</strong>
          {item.body && <span className="block text-xs mt-1 text-slate-600 dark:text-slate-300 break-words line-clamp-2">{item.body}</span>}
          <span className="block text-xs mt-2 text-slate-600 dark:text-slate-300">{fmt(item.receivedAt)} · Не подтверждено независимо</span>
        </button>)}
   </div>
  </div>
  <p className="text-xs text-slate-600 dark:text-slate-300">Обновлено: {fmt(state.updated)} · Автообновление раз в 30 секунд при открытой вкладке. Heartbeat не гарантирует получение push; отсутствие записей не означает отсутствие тревог. Автоматический запуск эфира отключён.</p>
 </section>;
}
