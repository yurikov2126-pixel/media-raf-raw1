import {useCallback,useEffect,useMemo,useState} from 'react';
import {api} from '../api/client.js';
import RadioSourceControl from './RadioSourceControl.jsx';
import RadioAutoDjSettings from './RadioAutoDjSettings.jsx';
import RadioRotationSettings from './RadioRotationSettings.jsx';
import RadioJingleSettings from './RadioJingleSettings.jsx';
import RadioTimeSignalSettings from './RadioTimeSignalSettings.jsx';
import RadioAutoPlaylistRecurrence from './RadioAutoPlaylistRecurrence.jsx';
import RadioAudioProcessing from './RadioAudioProcessing.jsx';
import RadioCueEditor from './RadioCueEditor.jsx';

const modules=[
 {id:'autodj',name:'AutoDJ',description:'Музыка между передачами'},
 {id:'recurrence',name:'Расписание генерации',description:'Правила и регулярная подготовка'},
 {id:'rotation',name:'Ротация',description:'Повторы и исполнители'},
 {id:'jingles',name:'Джинглы',description:'Эфирные отбивки'},
 {id:'time-signal',name:'Объявление времени',description:'Записи точного часа'},
 {id:'sound',name:'Звук и переходы',description:'Обработка и точки воспроизведения'},
 {id:'sources',name:'Источники',description:'Приоритеты и резервирование'}
];
function Status({label,positive=false}){return <span className={'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold '+(positive?'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300':'border-current/15 opacity-70')}>{label}</span>;}
export default function RadioAutomationConsole({token,playlists=[],assets=[],onOpen}){
 const [section,setSection]=useState('autodj');
 const [overview,setOverview]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const call=useCallback((path)=>api('/radio'+path,{token}),[token]);
 const refresh=useCallback(async()=>{
  setBusy(true);
  try{
   const results=await Promise.allSettled([call('/autodj'),call('/auto-playlist-automation'),call('/auto-playlist-rules'),call('/auto-playlists')]);
   const value=i=>results[i].status==='fulfilled'?results[i].value:null;
   setOverview({autodj:value(0)?.settings??null,automation:value(1),rules:value(2)?.rules??null,autoPlaylists:value(3)?.autoPlaylists??null});
   if(results.every(x=>x.status==='rejected'))setError('Не удалось получить состояние автоматизации');
   else setError(results.some(x=>x.status==='rejected')?'Часть настроек недоступна. Проверяйте состояние в соответствующем модуле.':'');
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 },[call]);
 useEffect(()=>{void refresh();},[refresh]);
 const activeRules=overview?.rules?.filter(r=>r.enabled).length??null;
 const approved=useMemo(()=>playlists.filter(p=>p.status==='APPROVED').length,[playlists]);
 const status={
  autodj:overview?.autodj?{label:overview.autodj.enabled?'Включён':'Выключен',ok:overview.autodj.enabled}:null,
  recurrence:overview?.automation?{label:overview.automation.enabled?'Автоматически':'Вручную',ok:overview.automation.enabled}:null
 };
 return <section className="space-y-4" aria-label="Центр автоматизации Radio 3.0">
  <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-current/15 bg-white/60 p-4 dark:bg-slate-900/50">
   <div><p className="text-[11px] font-bold uppercase tracking-[.2em] opacity-55">RADIO 3.0 · АВТОМАТИЗАЦИЯ</p>
    <h2 className="mt-1 text-xl font-bold">Центр управления автоматикой</h2>
    <p className="mt-1 text-xs opacity-65">Настройки и работающие механизмы сведены в одно рабочее пространство. Изменения применяются только после сохранения в соответствующем модуле.</p>
   </div>
   <button type="button" disabled={busy} onClick={refresh} className="rounded-xl border border-current/20 px-3 py-2 text-sm">{busy?'Проверка…':'↻ Проверить состояние'}</button>
  </header>
  {error&&<p role="alert" className="rounded-xl border border-amber-500/30 p-3 text-sm text-amber-800 dark:text-amber-200">{error}</p>}
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   <button type="button" onClick={()=>setSection('autodj')} className="radio-automation-stat text-left">
    <span className="text-xs opacity-65">AutoDJ</span><strong className="block text-lg">{overview?.autodj?.enabled?'Разрешён':overview?.autodj?'Отключён':'Нет данных'}</strong>
    {status.autodj&&<Status label={status.autodj.label} positive={status.autodj.ok}/>}
   </button>
   <button type="button" onClick={()=>setSection('recurrence')} className="radio-automation-stat text-left">
    <span className="text-xs opacity-65">Автоматическая генерация</span><strong className="block text-lg">{overview?.automation?.enabled?'Работает по правилам':overview?.automation?'Выключена':'Нет данных'}</strong>
    {status.recurrence&&<Status label={status.recurrence.label} positive={status.recurrence.ok}/>}
   </button>
   <button type="button" onClick={()=>setSection('recurrence')} className="radio-automation-stat text-left">
    <span className="text-xs opacity-65">Активные правила</span><strong className="block text-2xl tabular-nums">{activeRules??'—'}</strong>
    <span className="text-xs opacity-60">из {overview?.rules?.length??'—'} созданных</span>
   </button>
   <button type="button" onClick={()=>onOpen?.('playlists')} className="radio-automation-stat text-left">
    <span className="text-xs opacity-65">Утверждено плейлистов</span><strong className="block text-2xl tabular-nums">{approved}</strong>
    <span className="text-xs opacity-60">Открыть плейлисты ↗</span>
   </button>
  </div>
  <div className="rounded-xl border border-current/15 px-4 py-3 text-xs opacity-80">
   {overview?.automation?.enabled&&activeRules===0?'⚠ Автоматическая генерация включена, но активных правил пока нет.':
    overview?.automation?.enabled?'Регулярные правила создают только будущие слоты. Конфликты и уже идущие передачи не заменяются.':
    'Автоматическая подготовка будущих эфиров сейчас не включена. Правила можно тестировать вручную.'}
  </div>
  <div className="grid items-start gap-4 lg:grid-cols-[235px_minmax(0,1fr)]">
   <nav aria-label="Настройки радиоавтоматики" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:sticky lg:top-24 lg:grid-cols-1">
    {modules.map(m=><button key={m.id} type="button" aria-current={section===m.id?'page':undefined}
     onClick={()=>setSection(m.id)} className={'radio-automation-nav rounded-xl border p-3 text-left '+(section===m.id?'radio-automation-nav-active':'border-current/15')}>
     <span className="block text-sm font-semibold">{m.name}</span><span className="block text-[11px] opacity-65">{m.description}</span>
    </button>)}
   </nav>
   <div className="min-w-0 space-y-3">
    {section==='autodj'&&<RadioAutoDjSettings token={token} playlists={playlists}/>}
    {section==='recurrence'&&<section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-current/15 p-3">
       <p className="text-xs opacity-75">Для настройки шаблонов и ручного редактирования сгенерированных плейлистов откройте раздел «Автоплейлисты».</p>
       <button type="button" onClick={()=>onOpen?.('auto-playlists')} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white">Открыть автоплейлисты ↗</button>
      </div>
      <RadioAutoPlaylistRecurrence token={token}/>
    </section>}
    {section==='rotation'&&<RadioRotationSettings token={token} assets={assets}/>}
    {section==='jingles'&&<RadioJingleSettings token={token} assets={assets}/>}
    {section==='time-signal'&&<RadioTimeSignalSettings token={token}/>}
    {section==='sound'&&<div className="space-y-4"><RadioAudioProcessing token={token}/><RadioCueEditor token={token} assets={assets}/></div>}
    {section==='sources'&&<RadioSourceControl token={token}/>}
   </div>
  </div>
  <p className="text-xs opacity-60">Индикаторы показывают сохранённую конфигурацию, а не подтверждение фактического воспроизведения. Реальный эфир проверяйте в «Эфирном центре».</p>
 </section>;
}
