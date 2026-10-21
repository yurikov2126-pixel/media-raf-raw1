import {useCallback,useEffect,useMemo,useState} from 'react';
import {api} from '../api/client.js';
import RadioControlRoom from './RadioControlRoom.jsx';
import RadioUpcomingQueue from './RadioUpcomingQueue.jsx';
import './radio-command-studio.css';

const MOSCOW='Europe/Moscow';
const stamp=v=>v?new Date(v).toLocaleTimeString('ru-RU',{timeZone:MOSCOW,hour:'2-digit',minute:'2-digit'}):'—';
const clock=v=>new Date(v).toLocaleTimeString('ru-RU',{timeZone:MOSCOW,hour:'2-digit',minute:'2-digit',second:'2-digit'});
const mm=ms=>{const n=Math.max(0,Math.floor(Number(ms)||0)/1000);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
const MODES={AUTO_DJ:'AutoDJ',SCHEDULED:'По сетке',LIVE:'Студия',JINGLE:'Джингл',SILENCE:'Тишина',ERROR:'Ошибка',STARTING:'Запуск'};
function Status({label,state,detail,kind='ok'}){return <div className="rcs-status-tile"><span className={'rcs-status-dot '+kind}/><div><span className="rcs-status-label">{label}</span><strong>{state}</strong><small>{detail}</small></div></div>}
export default function RadioCommandStudio({token,slots=[],playlists=[],assets=[],onOpen,onRefresh}){
 const [report,setReport]=useState(null),[worker,setWorker]=useState(null),[nowPlaying,setNowPlaying]=useState(null);
 const [error,setError]=useState(''),[updated,setUpdated]=useState(null),[loading,setLoading]=useState(false);
 const [now,setNow]=useState(Date.now()),[queueTab,setQueueTab]=useState('programs');
 const [engineering,setEngineering]=useState(false),[layout,setLayout]=useState('standard');
 const [showActions,setShowActions]=useState(false);
 const refresh=useCallback(async()=>{
  setLoading(true);
  const results=await Promise.allSettled([
   api('/radio-agent/dashboard',{token}),
   api('/radio-agent/dashboard/now-playing',{token}),
   api('/radio-agent/dashboard/worker',{token})
  ]);
  setReport(results[0].status==='fulfilled'?results[0].value:null);
  setNowPlaying(results[1].status==='fulfilled'?results[1].value:null);
  setWorker(results[2].status==='fulfilled'?results[2].value:null);
  setUpdated(Date.now());
  setError(results[0].status==='rejected'?'Нет соединения с сервером эфира':'');
  setLoading(false);
 },[token]);
 useEffect(()=>{void refresh();const id=setInterval(refresh,8000);return()=>clearInterval(id);},[refresh]);
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[]);
 const onAir=nowPlaying?.onAir||nowPlaying?.nowPlaying||nowPlaying||{};
 const track=onAir.track||report?.onAir?.track||null;
 const rawMode=onAir.mode||report?.onAir?.mode||null;
 const mode=MODES[rawMode]||rawMode||'Не определён';
 const health=Boolean(onAir.available)&&rawMode!=='ERROR'&&rawMode!=='SILENCE';
 const playout=onAir.playout?.trackId===track?.id?onAir.playout:null;
 const elapsedReport=onAir.observedAt?Math.min(30000,Math.max(0,now-Date.parse(onAir.observedAt))):0;
 const elapsed=Math.max(0,(playout?.seekMs||0)+(playout?.emittedMs||0)+(playout?.startedAt?elapsedReport:0));
 const total=playout?.durationMs||track?.durationMs||0;
 const percent=total>0?Math.min(100,100*elapsed/total):0;
 const upcoming=useMemo(()=>Array.isArray(report?.upcoming)?report.upcoming:slots.filter(s=>Date.parse(s.endAt)>now).sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)).slice(0,12),[report?.upcoming,slots,now]);
 const upcomingSlot=onAir.upcomingSlot||upcoming[0];
 const next=onAir.nextTrack;
 const trackName=[track?.artist,track?.title].filter(Boolean).join(' — ')||track?.name||'Нет подтверждённых данных о композиции';
 const working=worker?.available===true||worker?.status==='RUNNING'||worker?.running===true;
 const streamStatus=report?.stream?.status;
 const compact=layout==='compact';
 return <div className={'rcs '+(compact?'rcs-compact':'')} aria-label="Radio Command Studio">
  <header className="rcs-toolbar">
   <div className="rcs-station"><span className="rcs-mark">◉</span><div><strong>Политех-FM</strong><small>RADIO COMMAND STUDIO</small></div></div>
   <div className="rcs-clock"><span>МОСКВА · ВРЕМЯ СТАНЦИИ</span><strong className="tabular-nums">{clock(now)}</strong></div>
   <div className={'rcs-onair-status '+(health?'on':'off')}><span className="rcs-status-dot"/><div><strong>{health?'Эфир активен':rawMode==='ERROR'?'Ошибка эфира':'Нет подтверждения эфира'}</strong><small>{mode}</small></div></div>
   <div className="rcs-toolbar-actions">
    <button type="button" onClick={()=>{void refresh();onRefresh?.();}} disabled={loading}>↻ <span className="rcs-btnlabel">{loading?'Обновление':'Обновить'}</span></button>
    <button type="button" onClick={()=>onOpen('studio')}>◉ <span className="rcs-btnlabel">Открыть студию</span></button>
    <button type="button" onClick={()=>setShowActions(v=>!v)} aria-expanded={showActions}>⚡ Действия ▾</button>
   </div>
  </header>
  {showActions&&<div className="rcs-quick-popover" aria-label="Быстрые действия">{[['schedule','Сетка'],['playlists','Плейлисты'],['assets','Медиатека'],['history','Мониторинг'],['equipment','Оборудование']].map(([id,label])=><button type="button" key={id} onClick={()=>{setShowActions(false);onOpen(id);}}>{label} ↗</button>)}</div>}
  {error&&<div className="rcs-error" role="alert">{error}. Последнее обновление: {updated?stamp(updated):'—'}</div>}
  <div className="rcs-dashboard">
   <section className="rcs-hero">
    <div className="rcs-section-heading"><span className="rcs-live-indicator">● СЕЙЧАС В ЭФИРЕ</span><span className="rcs-source-pill">{mode}</span></div>
    <div className="rcs-hero-content">
     <div className="rcs-cover" aria-hidden="true"><span>♫</span><small>ПОЛИТЕХ-FM</small></div>
     <div className="rcs-hero-track">
      <h2>{trackName}</h2>
      <p>{onAir.slot?.name||onAir.slot?.playlist?.name||'Радиовещание'}</p>
      <div className="rcs-track-meter" role="progressbar" aria-label="Прогресс текущей композиции" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><i style={{width:percent+'%'}}/></div>
      <div className="rcs-times"><span>{total?mm(elapsed):'—'}</span><span>{total?mm(total):'Длительность неизвестна'}</span></div>
      <div className="rcs-hero-footer"><span>Источник: <b>{mode}</b></span><span>Следующий трек: <b>{next?[next.artist,next.title].filter(Boolean).join(' — ')||next.name:'нет данных'}</b></span></div>
     </div>
    </div>
    <div className="rcs-listen"><span>ПРОСЛУШИВАНИЕ ЭФИРА</span><audio controls preload="none" src="/api/radio-agent/listen" aria-label="Публичный поток Политех-FM"/></div>
   </section>
   <section className="rcs-module rcs-queue"><div className="rcs-module-heading"><div><span className="rcs-eyebrow">ЭФИРНАЯ ОЧЕРЕДЬ</span><h3>Далее в эфире</h3></div><button onClick={()=>onOpen('schedule')} type="button">Вся сетка ↗</button></div>
    <div className="rcs-tabstrip" role="group" aria-label="Очередь">
     <button aria-pressed={queueTab==='programs'} onClick={()=>setQueueTab('programs')}>Передачи <b>{upcoming.length}</b></button>
     <button aria-pressed={queueTab==='tracks'} onClick={()=>setQueueTab('tracks')}>Следующий трек</button>
    </div>
    {queueTab==='programs'?<RadioUpcomingQueue entries={upcoming} token={token} onSchedule={()=>onOpen('schedule')} onPlaylists={()=>onOpen('playlists')}/>:
     <div className="rcs-next-track"><strong>{next?[next.artist,next.title].filter(Boolean).join(' — ')||next.name:'Автоматическая очередь не предоставлена сервером'}</strong><small>Это прогноз от сервера, не ручная команда переключения трека.</small></div>}
   </section>
   <section className="rcs-module rcs-sources"><div className="rcs-module-heading"><div><span className="rcs-eyebrow">КОММУТАЦИЯ</span><h3>Источники и управление</h3></div><button type="button" onClick={()=>onOpen('automation')}>Настройки ↗</button></div>
    <div className="rcs-source-grid"><Status label="Активный источник" state={mode} detail="Фактические данные Worker" kind={health?'ok':'unknown'}/>
     <Status label="Ближайшая передача" state={upcomingSlot?.name||upcomingSlot?.playlist?.name||'Не назначена'} detail={upcomingSlot?.startAt?'Начало: '+stamp(upcomingSlot.startAt):'Нет сведений'} kind="unknown"/>
     <Status label="Поток" state={streamStatus||'Статус неизвестен'} detail="Состояние серверного потока" kind={!streamStatus?'unknown':/online|running|active/i.test(streamStatus)?'ok':'warn'}/>
     <Status label="Слушатели" state={onAir.listenerCount??report?.listenerCount??'Нет данных'} detail="По данным сервера" kind="unknown"/></div>
   </section>
   <section className="rcs-module rcs-monitor"><div className="rcs-module-heading"><div><span className="rcs-eyebrow">ТЕХНИЧЕСКОЕ СОСТОЯНИЕ</span><h3>Диагностика</h3></div><button onClick={()=>onOpen('history')} type="button">Мониторинг ↗</button></div>
    <div className="rcs-monitor-grid"><Status label="Playout Worker" state={worker?(working?'Работает':'Данные получены'):'Нет данных'} detail="Центральный аудиодвижок" kind={!worker?'unknown':working?'ok':'warn'}/>
     <Status label="Windows Agent" state="Смотреть оборудование" detail="Проверка состояния агента" kind="unknown"/>
     <Status label="Реальный эфир" state={health?'Активен':'Не подтверждён'} detail="Публичный поток и метаданные" kind={health?'ok':'warn'}/>
     <Status label="Переходы" state="Открыть диагностику" detail="Crossfade / PCM" kind="unknown"/></div>
    <button className="rcs-details-button" type="button" onClick={()=>setEngineering(v=>!v)} aria-expanded={engineering}>{engineering?'Скрыть технический пульт ↑':'Развернуть технический пульт ↓'}</button>
   </section>
   <section className="rcs-module rcs-actions"><div className="rcs-module-heading"><div><span className="rcs-eyebrow">РАБОЧИЕ ИНСТРУМЕНТЫ</span><h3>Быстрые действия</h3></div><button type="button" onClick={()=>setLayout(v=>v==='standard'?'compact':'standard')}>{compact?'Обычный вид':'Компактный вид'}</button></div>
    <div className="rcs-actions-grid">{[['schedule','▦','Открыть сетку'],['playlists','☷','Редактор плейлистов'],['studio','◉','Студия'],['assets','♫','Медиатека'],['history','≋','Мониторинг'],['equipment','▣','Оборудование']].map(([id,icon,label])=><button key={id} type="button" onClick={()=>onOpen(id)}><span>{icon}</span>{label}<b>↗</b></button>)}</div>
   </section>
  </div>
  {engineering&&<section className="rcs-engineering"><div className="rcs-module-heading"><h3>Инженерный пульт · существующие инструменты</h3><button type="button" onClick={()=>setEngineering(false)}>Свернуть ↑</button></div><RadioControlRoom token={token} onOpen={onOpen}/></section>}
 </div>;
}
