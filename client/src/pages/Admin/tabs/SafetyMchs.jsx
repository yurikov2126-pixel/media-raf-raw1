import {useEffect,useState} from 'react';
import {useSearchParams,Link} from 'react-router-dom';
import {api} from '../../../api/client.js';
import {useTheme} from '../../../store/theme.jsx';
import MchsTransportStatus from './MchsTransportStatus.jsx';
import MchsOperationalOverview from './MchsOperationalOverview.jsx';
import MchsEventTypeRules from './MchsEventTypeRules.jsx';
import MchsEventJournal from '../../../components/MchsEventJournal.jsx';
import MchsDeliveryReliability from './MchsDeliveryReliability.jsx';
import MchsQueueMonitor from './MchsQueueMonitor.jsx';
import './mchsWorkspace.css';

const PANES=[
 ['overview','Обзор и эфир'],
 ['rules','Оповещения'],
 ['events','Журнал событий'],
 ['delivery','Доставка и неисправности']
];
const ALIASES={
 simulation:'overview',settings:'rules',reliability:'delivery',queue:'delivery',
 incidents:'delivery',analytics:'overview'
};

/** Production-only MCHS workspace. Historical lab components remain in the
 * repository for compatibility but are not loaded into the real operations UI.
 */
export default function SafetyMchs({token}){
 const {resolved}=useTheme();
 const [params,setParams]=useSearchParams();
 const [journal,setJournal]=useState(null);
 const [journalError,setJournalError]=useState('');
 const [lastUpdated,setLastUpdated]=useState(null);
 const requested=params.get('mchsView');
 const pane=params.has('incident')?'delivery':
  PANES.some(([id])=>id===(ALIASES[requested]||requested))?
   (ALIASES[requested]||requested):'overview';
 const navigate=(next,incidentId)=>{
  const p=new URLSearchParams(params);
  p.set('tab','safety-mchs');p.set('mchsView',next);
  if(incidentId)p.set('incident',incidentId);
  else p.delete('incident');
  if(next!=='events'&&next!=='rules')p.delete('mchsEvent');
  setParams(p,{replace:true});
 };
 useEffect(()=>{
  if(pane!=='events')return;
  let alive=true;
  const load=()=>api('/safety/dashboard',{token}).then(data=>{
   if(!alive)return;
   setJournal(data);setJournalError('');setLastUpdated(new Date());
  }).catch(e=>{if(alive)setJournalError(e.message||'Не удалось получить журнал');});
  void load();
  const timer=setInterval(()=>{if(!document.hidden)void load();},30000);
  return()=>{alive=false;clearInterval(timer);};
 },[token,pane]);
 return <div data-mchs-theme={resolved} className="mchs-admin-workspace space-y-4">
  <header className="rounded-2xl border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-white/5 p-4 sm:p-5 space-y-2">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
     <h2 className="text-xl font-semibold">Экстренное оповещение</h2>
     <p className="text-sm text-slate-600 dark:text-slate-300">Политех-FM · Android → Radio Worker → Windows Agent → усилитель</p>
    </div>
    <Link to="/app/safety" className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/10">Пульт безопасности</Link>
   </div>
   <p className="text-xs text-slate-500 dark:text-slate-400">Настройки готовности и фактическое исполнение — разные показатели. При неисправности радио сохраняйте штатные способы оповещения.</p>
  </header>
  <nav aria-label="Разделы экстренного оповещения" className="mchs-section-tabs flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
   {PANES.map(([id,label])=><button key={id} type="button"
    aria-current={pane===id?'page':undefined}
    onClick={()=>navigate(id)}
    className={`shrink-0 snap-start rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${pane===id?
     'bg-violet-600 border-violet-600 text-white':
     'border-slate-200 dark:border-white/20 bg-white/70 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10'}`}>{label}</button>)}
  </nav>
  {pane==='overview'&&<div className="space-y-4">
   <MchsTransportStatus token={token}/>
   <MchsOperationalOverview token={token} onOpen={navigate}/>
  </div>}
  {pane==='rules'&&<MchsEventTypeRules token={token}/>}
  {pane==='events'&&<section className="rounded-2xl border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-white/5 p-4 sm:p-5 space-y-3">
   <div className="flex flex-wrap justify-between items-center gap-2">
    <div><h3 className="text-lg font-semibold">Журнал уведомлений</h3>
     <p className="text-xs text-slate-600 dark:text-slate-300">Полученные сообщения Android и история обработки. Показ в журнале не означает, что звук уже прозвучал.</p></div>
    {lastUpdated&&<span className="text-xs text-slate-500">Обновлено {lastUpdated.toLocaleTimeString('ru-RU')}</span>}
   </div>
   {journalError&&<p role="alert" className="text-sm text-red-600 dark:text-red-300">{journalError}</p>}
   <MchsEventJournal token={token} events={journal?.events||[]} total={journal?.eventCount||0}/>
  </section>}
  {pane==='delivery'&&<div className="space-y-4">
   <nav aria-label="Диагностика доставки" className="flex gap-2 overflow-x-auto">
    {[
     ['delivery','Состояние доставки'],
     ['incidents','Неисправности'],
     ['queue','Очередь анализа']
    ].map(([id,label])=><button key={id} type="button" onClick={()=>navigate(id)}
     aria-pressed={(params.has('incident')?'incidents':requested||'delivery')===id}
     className={`shrink-0 rounded-xl border px-3 py-2 text-sm ${(params.has('incident')?'incidents':requested||'delivery')===id?
      'bg-violet-600 border-violet-600 text-white':
      'border-slate-300 dark:border-white/20 hover:bg-slate-100 dark:hover:bg-white/10'}`}>
      {label}
     </button>)}
   </nav>
   {!(params.has('incident')||requested==='incidents'||requested==='queue')&&
    <MchsDeliveryReliability token={token} onOpen={navigate}/>}
   {(params.has('incident')||requested==='incidents')&&
    <MchsQueueMonitor token={token} view="incidents"/>}
   {requested==='queue'&&!params.has('incident')&&
    <MchsQueueMonitor token={token} view="queue"/>}
  </div>}
 </div>;
}
