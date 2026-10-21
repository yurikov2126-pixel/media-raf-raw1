import './radio-command-studio.css';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {api} from '../api/client.js';
import RadioAmplifierControl from './RadioAmplifierControl.jsx';
import RadioUpcomingQueue from './RadioUpcomingQueue.jsx';
import {useRadioStreamRecovery} from '../hooks/useRadioStreamRecovery.js';
import {useRadioLufsMeter} from '../hooks/useRadioLufsMeter.js';

const zone='Europe/Moscow';
const clock=(value)=>new Date(value).toLocaleTimeString('ru-RU',{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit'});
const fmt=(value)=>value?new Date(value).toLocaleTimeString('ru-RU',{timeZone:zone,hour:'2-digit',minute:'2-digit'}):'—';
const duration=ms=>{const n=Math.floor(Math.max(0,ms||0)/1000);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
const sourceName={AUTO_DJ:'AutoDJ',SCHEDULED:'По сетке',LIVE:'Студия',JINGLE:'Джингл',SILENCE:'Тишина',ERROR:'Ошибка',STARTING:'Запуск'};
const stateText=(x)=>x===true?'Подключён':x===false?'Недоступен':'Нет данных';

function Status({title,state,detail,onClick}){
 const known=state===true||state===false;
 return <div className="rcs-status">
  <span className={'rcs-led '+(state===true?'ok':state===false?'bad':'unknown')} aria-label={known?(state?'Работает':'Недоступно'):'Нет данных'}/>
  <div><strong>{title}</strong><small>{detail||stateText(state)}</small></div>
  {onClick&&<button type="button" onClick={onClick} aria-label={'Открыть '+title}>↗</button>}
 </div>;
}
function Panel({title,action,children,extraClass=''}) {
 return <section className={'rcs-panel '+extraClass}><div className="rcs-panel-head"><h2>{title}</h2>{action}</div>{children}</section>;
}

export default function RadioCommandStudio({token,slots=[],playlists=[],assets=[],onOpen}){
 const [now,setNow]=useState(()=>Date.now());
 const {audioRef,playing,reconnecting,error:playbackError,audioEvents}=useRadioStreamRecovery();
 const loudness=useRadioLufsMeter(audioRef,playing);
 const [volume,setVolume]=useState(0.8);
 const [muted,setMuted]=useState(false);
 const [lastPlaying,setLastPlaying]=useState(null);
 useEffect(()=>{if(audioRef.current)audioRef.current.volume=volume;},[]);
 const [playerBusy,setPlayerBusy]=useState(false);
 const togglePlayback=async()=>{
  const node=audioRef.current;if(!node)return;
  if(!node.paused){node.pause();return;}
  setPlayerBusy(true);
  try{await node.play();}catch{/* Browser playback policy or network error surfaced by audio events. */}
  finally{setPlayerBusy(false);}
 };
 const reconnect=async()=>{
  const node=audioRef.current;if(!node)return;
  const shouldResume=!node.paused||playing;
  node.pause();node.src='/api/radio-agent/listen?manual='+Date.now();node.load();
  if(shouldResume){try{await node.play();}catch{/* Visible audio error below. */}}
 };
 const updateVolume=value=>{
  const next=Number(value);setVolume(next);
  if(audioRef.current)audioRef.current.volume=next;
  if(next>0){setMuted(false);if(audioRef.current)audioRef.current.muted=false;}
 };
 const toggleMute=()=>{setMuted(v=>{if(audioRef.current)audioRef.current.muted=!v;return !v;});};

 const [report,setReport]=useState(null),[metadata,setMetadata]=useState(null),[worker,setWorker]=useState(null),[amp,setAmp]=useState(null);
 const [results,setResults]=useState({}),[loadedAt,setLoadedAt]=useState(null),[refreshing,setRefreshing]=useState(false);
 const [queueOpen,setQueueOpen]=useState(true),[tab,setTab]=useState('tracks'),[details,setDetails]=useState(false);
 const refresh=useCallback(async()=>{
  setRefreshing(true);
  const paths={report:'/radio-agent/dashboard',metadata:'/radio-agent/dashboard/now-playing',worker:'/radio-agent/dashboard/worker',amp:'/radio-agent/amplifier'};
  const entries=await Promise.all(Object.entries(paths).map(async([key,path])=>{try{return[key,{value:await api(path,{token}),ok:true}];}catch{return[key,{value:null,ok:false}];}}));
  const map=Object.fromEntries(entries);setReport(map.report.value);setMetadata(map.metadata.value);
  setWorker(map.worker.value);setAmp(map.amp.value);
  setResults(Object.fromEntries(entries.map(([key,v])=>[key,v.ok])));setLoadedAt(Date.now());setRefreshing(false);
 },[token]);
 useEffect(()=>{void refresh();const tick=setInterval(()=>void refresh(),10000);return()=>clearInterval(tick);},[refresh]);
 useEffect(()=>{const tick=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(tick);},[]);
 const source=metadata?.mode;
 const track=metadata?.track;
 const playout=metadata?.playout;
 const running=metadata?.available===true&&source!=='ERROR'&&source!=='SILENCE';
 const playMs=playout?.trackId===track?.id?Math.max(0,(playout?.seekMs||0)+(playout?.emittedMs||0)+(playout?.startedAt?Math.max(0,now-Date.parse(metadata.observedAt||now)):0)):0;
 const totalMs=playout?.durationMs||track?.durationMs||0;
 const progress=totalMs>0?Math.max(0,Math.min(100,playMs/totalMs*100)):0;
 const upcoming=Array.isArray(report?.upcoming)?report.upcoming:[];
 const planned=useMemo(()=>slots.filter(s=>s.endAt&&Date.parse(s.endAt)>Date.now()).sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)).slice(0,8),[slots]);
 const formatTrack=track?[track.artist,track.title].filter(Boolean).join(' — ')||track.name:'Нет подтверждённых данных о композиции';
 return <div className="rcs-home">
  <header className="rcs-toolbar">
   <div><p className="rcs-eyebrow">POLITECH-FM · RADIO COMMAND STUDIO</p><h1>Управление эфиром</h1></div>
   <div className="rcs-toolbar-actions">
    <div className="rcs-clock"><small>ВРЕМЯ СТАНЦИИ · МОСКВА</small><strong>{clock(now)}</strong></div>
    <span className={'rcs-onair-pill '+(results.metadata?(running?'running':'stopped'):'unknown')}><span className="rcs-led"/>{!results.metadata?'Нет телеметрии':running?'Эфир активен':'Эфир требует внимания'}</span>
    <button type="button" disabled={refreshing} onClick={()=>void refresh()}>{refreshing?'Обновление…':'↻ Обновить'}</button>
    <button type="button" className="rcs-primary" onClick={()=>onOpen('studio')}>Открыть студию ↗</button>
   </div>
  </header>
  <div className="rcs-grid">
   <section className="rcs-onair">
    <div className="rcs-onair-top"><span className="rcs-eyebrow">● СЕЙЧАС В ЭФИРЕ</span><span className="rcs-source">{results.metadata?sourceName[source]||source:'Источник неизвестен'}</span><span className="rcs-onair-indicator">{running?'ON AIR':'НЕ ПОДТВЕРЖДЕНО'}</span></div>
    <div className="rcs-track">
     <div className="rcs-cover" aria-hidden="true"><span>♫</span></div>
     <div className="rcs-track-main"><p className="rcs-eyebrow">ФАКТИЧЕСКИЕ МЕТАДАННЫЕ PCM</p><h2>{formatTrack}</h2>
      <p>{metadata?.slot?.name||metadata?.slot?.playlist?.name||'Политех-FM'}</p>
      <div className="rcs-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Позиция текущей записи"><span style={{width:progress+'%'}}/></div>
      <div className="rcs-time"><span>{totalMs?duration(playMs):'—'}</span><span>{totalMs?duration(totalMs):'—'}</span></div>
      <small>Прогресс расчётный по данным Worker; не подтверждает слышимый сигнал на удалённом устройстве.</small>
     </div>
    </div>
    <div className="rcs-player" aria-label="Контрольный эфирный плеер">
     <div className="rcs-player-main">
      <button className="rcs-player-play" type="button" disabled={playerBusy} onClick={()=>void togglePlayback()} aria-label={playing?'Приостановить локальное прослушивание':'Слушать эфир'}>{playing?'Ⅱ':'▶'}</button>
      <div className="rcs-player-info"><div><strong>ПОЛИТЕХ-FM · LIVE</strong><span className={'rcs-player-dot '+(playing?'playing':'')}/></div>
       <p role="status">{reconnecting?'Переподключение…':playing?'Поток воспроизводится':playbackError?'Ошибка подключения':'Прослушивание выключено'}</p>
      </div>
      <div className="rcs-player-controls">
       <button type="button" onClick={toggleMute} aria-label={muted?'Включить звук':'Выключить звук'} title={muted?'Включить звук':'Выключить звук'}>{muted||volume===0?'◌':'♫'}</button>
       <input aria-label="Громкость локального прослушивания" type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>updateVolume(e.target.value)}/>
       <button type="button" onClick={()=>void reconnect()} title="Переподключиться" aria-label="Переподключить MP3-поток">↻</button>
       <a href="/radio/live" target="_blank" rel="noopener noreferrer" title="Открыть эфирный плеер в отдельной вкладке" aria-label="Открыть эфирный плеер в отдельной вкладке">↗</a>
      </div>
     </div>
     <audio ref={audioRef} {...audioEvents} preload="none" src="/api/radio-agent/listen" onPlaying={()=>setLastPlaying(Date.now())} aria-label="MP3-поток Политех-FM"/>
     {playbackError&&<p className="rcs-player-error" role="alert">{playbackError}</p>}
     <div className="rcs-lufs" aria-live="off">
      <div className="rcs-lufs-title"><strong>Громкость эфира · LUFS</strong><span>EBU R128 · измерение декодированного MP3</span></div>
      <div className="rcs-lufs-values">
       <div><span>Momentary · 400 мс</span><strong>{loudness.state==='measuring'&&loudness.momentary!==null?loudness.momentary.toFixed(1):'—'} <small>LUFS</small></strong></div>
       <div><span>Short-term · 3 с</span><strong>{loudness.state==='measuring'&&loudness.shortTerm!==null?loudness.shortTerm.toFixed(1):'—'} <small>LUFS</small></strong></div>
      </div>
      <p>{loudness.state==='unsupported'?'Измеритель недоступен в этом браузере или при текущей частоте дискретизации.':loudness.state==='warming'?'Накапливаем данные для измерения…':loudness.state==='measuring'?'Измеряется принимаемый MP3, не исходный PCM до кодирования.':'Нажмите Play, чтобы измерить громкость принимаемого эфира.'}</p>
     </div>
     <div className="rcs-player-footer"><small>Локальное прослушивание — не управление эфиром</small><small>{lastPlaying?'Последнее воспроизведение: '+clock(lastPlaying):'Ожидание запуска'}</small></div>
    </div>
    <div className="rcs-onair-footer"><span>Следующее по плану: {fmt(upcoming[0]?.startAt||planned[0]?.startAt)}</span><div><button type="button" onClick={()=>onOpen('schedule')}>Сетка ↗</button><button type="button" onClick={()=>onOpen('history')}>Техмониторинг ↗</button></div></div>
   </section>
   <Panel title="Далее в эфире" extraClass="rcs-queue" action={<button type="button" onClick={()=>setQueueOpen(x=>!x)} aria-expanded={queueOpen}>{queueOpen?'Свернуть':'Развернуть'}</button>}>
    <div className="rcs-tabs" role="tablist" aria-label="Тип очереди"><button type="button" role="tab" aria-selected={tab==='tracks'} className={tab==='tracks'?'selected':''} onClick={()=>setTab('tracks')}>Ближайшие передачи</button><button type="button" role="tab" aria-selected={tab==='grid'} className={tab==='grid'?'selected':''} onClick={()=>setTab('grid')}>Сетка</button></div>
    {queueOpen&&(tab==='tracks'?<RadioUpcomingQueue entries={upcoming} token={token} onSchedule={()=>onOpen('schedule')} onPlaylists={()=>onOpen('playlists')}/>:<div className="rcs-schedule-items">{planned.map(s=><button type="button" key={s.id} onClick={()=>onOpen('schedule')}><span>{fmt(s.startAt)}</span><strong>{s.title||s.name||s.playlist?.name||'Передача'}</strong><span>↗</span></button>)}{!planned.length&&<p>Нет предстоящих событий в загруженной сетке.</p>}</div>)}
    <p className="rcs-disclaimer">Очередь отображает утверждённый план, а не ручное управление текущим PCM.</p>
   </Panel>
   <Panel title="Источники и управление" extraClass="rcs-sources" action={<button type="button" onClick={()=>onOpen('automation')}>Автоматизация ↗</button>}>
    <div className="rcs-status-grid">
     <Status title="Основной источник" state={results.metadata?running:null} detail={results.metadata?sourceName[source]||source:'Нет телеметрии'} onClick={()=>onOpen('automation')}/>
     <Status title="Эфирная сетка" state={results.report?Boolean(report?.cursor):null} detail={report?.cursor?.status||'Нет состояния курсора'} onClick={()=>onOpen('schedule')}/>
     <Status title="PCM Worker" state={results.worker?true:null} detail={results.worker?'Данные получены':'Нет ответа Worker'} onClick={()=>onOpen('history')}/>
     <Status title="Поток" state={results.report?Boolean(report?.stream):null} detail={report?.stream?.status||'Нет отчёта сервера'} onClick={()=>onOpen('history')}/>
    </div>
   </Panel>
   <Panel title="Диагностика и мониторинг" extraClass="rcs-diagnostics" action={<button type="button" onClick={()=>onOpen('history')}>Открыть мониторинг ↗</button>}>
    <div className="rcs-status-grid">
     <Status title="Playout Worker" state={results.worker?true:null} detail={results.worker?'Телеметрия отвечает':'Данные недоступны'}/>
     <Status title="Windows Radio Agent" state={null} detail="Пинг агента не подтверждён"/>
     <Status title="ESP32 · усилитель" state={results.amp?(amp?.connection==='ONLINE'):null} detail={results.amp?('Связь: '+(amp.connection||'неизвестна')):'Нет ответа API'}/>
     <Status title="Кроссфейды" state={worker?.transitions?worker.transitions.crossfadeFailed===0:null} detail={worker?.transitions?'Неудачных: '+(worker.transitions.crossfadeFailed??'—'):'Метрики недоступны'}/>
    </div>
    <button type="button" className="rcs-details-toggle" aria-expanded={details} onClick={()=>setDetails(v=>!v)}>{details?'Скрыть сведения':'Подробности подключения и усилителя'}</button>
    {details&&<div className="rcs-expanded"><p>Последняя проверка: {loadedAt?clock(loadedAt):'—'} · Интервал: 10 с</p><p>Источники: Worker {stateText(results.worker)} · Радио {stateText(results.metadata)} · ESP32 {stateText(results.amp)}</p><RadioAmplifierControl token={token}/></div>}
   </Panel>
   <Panel title="Быстрые действия" extraClass="rcs-actions">
    <div className="rcs-action-grid">{[['▦','Открыть сетку','schedule'],['☷','Плейлисты','playlists'],['♫','Медиатека','assets'],['⚙','Автоматизация','automation'],['▥','Мониторинг','history'],['▣','Оборудование','equipment']].map(([icon,label,id])=><button key={id} type="button" onClick={()=>onOpen(id)}><span>{icon}</span><strong>{label}</strong><span>↗</span></button>)}</div>
   </Panel>
  </div>
 </div>;
}
