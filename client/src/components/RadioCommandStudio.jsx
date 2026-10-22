import './radio-command-studio.css';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {api} from '../api/client.js';
import RadioAmplifierControl from './RadioAmplifierControl.jsx';
import RadioUpcomingQueue from './RadioUpcomingQueue.jsx';
import {useRadioStreamRecovery} from '../hooks/useRadioStreamRecovery.js';
import {RADIO_PRESETS,RADIO_WIDGETS,loadRadioLayout,saveRadioLayout,moveRadioWidget,normalizeRadioLayout} from './radioWorkspaceLayout.js';


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
 const [lufsHistory,setLufsHistory]=useState([]);
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

 const [report,setReport]=useState(null),[metadata,setMetadata]=useState(null),[worker,setWorker]=useState(null),[amp,setAmp]=useState(null),[health,setHealth]=useState(null);
 const [results,setResults]=useState({}),[loadedAt,setLoadedAt]=useState(null),[refreshing,setRefreshing]=useState(false);
 const loudness=worker?.loudness;
 const [layout,setLayout]=useState(()=>loadRadioLayout('radio-os2-layout'));
 const [layoutEditing,setLayoutEditing]=useState(false);
 const [dragging,setDragging]=useState(null);
 useEffect(()=>saveRadioLayout('radio-os2-layout',layout),[layout]);
 const patchLayout=callback=>setLayout(previous=>normalizeRadioLayout(callback(normalizeRadioLayout(previous))));
 const applyPreset=name=>{setLayout(normalizeRadioLayout(RADIO_PRESETS[name]));setLayoutEditing(false);};
 const widget=(id,content)=>{
  if(layout.hidden.includes(id))return null;
  const title=RADIO_WIDGETS.find(entry=>entry.id===id)?.name||id;
  return <div className={'rcs-os-widget '+(layout.wide.includes(id)?'rcs-os-wide':'')} key={id}
   style={{order:layout.order.indexOf(id)}} onDragOver={layoutEditing?event=>event.preventDefault():undefined}
   onDrop={layoutEditing?event=>{event.preventDefault();if(dragging)patchLayout(previous=>moveRadioWidget(previous,dragging,id));setDragging(null);}:undefined}>
   {layoutEditing&&<div className="rcs-os-widget-tools">
    <button type="button" draggable onDragStart={event=>{setDragging(id);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);}} onDragEnd={()=>setDragging(null)} aria-label={'Перетащить '+title}>⠿ Переместить</button>
    <strong>{title}</strong>
    <div className="rcs-os-move-buttons" aria-label={'Изменить порядок: '+title}>
     <button type="button" disabled={layout.order.indexOf(id)===0} aria-label={'Переместить '+title+' вверх'} onClick={()=>patchLayout(previous=>{const at=previous.order.indexOf(id);if(at<=0)return previous;const order=[...previous.order];[order[at-1],order[at]]=[order[at],order[at-1]];return {...previous,order};})}>↑</button>
     <button type="button" disabled={layout.order.indexOf(id)===layout.order.length-1} aria-label={'Переместить '+title+' вниз'} onClick={()=>patchLayout(previous=>{const at=previous.order.indexOf(id);if(at<0||at>=previous.order.length-1)return previous;const order=[...previous.order];[order[at+1],order[at]]=[order[at],order[at+1]];return {...previous,order};})}>↓</button>
    </div>
    <button type="button" onClick={()=>patchLayout(previous=>({...previous,wide:previous.wide.includes(id)?previous.wide.filter(x=>x!==id):[...previous.wide,id]}))}>{layout.wide.includes(id)?'Обычная ширина':'На всю ширину'}</button>
    {id!=='onair'&&<button type="button" onClick={()=>patchLayout(previous=>({...previous,hidden:[...previous.hidden,id]}))}>Скрыть</button>}
   </div>}
   {content}
  </div>;
 };
 const [queueOpen,setQueueOpen]=useState(true),[tab,setTab]=useState('tracks'),[details,setDetails]=useState(false);
 const refresh=useCallback(async()=>{
  setRefreshing(true);
  const paths={report:'/radio-agent/dashboard',metadata:'/radio-agent/dashboard/now-playing',worker:'/radio-agent/dashboard/worker',amp:'/radio-agent/amplifier',health:'/radio-agent/dashboard/devices-health'};
  const entries=await Promise.all(Object.entries(paths).map(async([key,path])=>{try{return[key,{value:await api(path,{token}),ok:true}];}catch{return[key,{value:null,ok:false}];}}));
  const map=Object.fromEntries(entries);setReport(map.report.value);setMetadata(map.metadata.value);
  setWorker(map.worker.value);setAmp(map.amp.value);setHealth(map.health.value);
  const measured=map.worker.value?.loudness;
  if(measured?.status==='RUNNING'&&!measured.stale){setLufsHistory(prev=>[...prev.slice(-39),{at:Date.now(),momentary:measured.momentary,integrated:measured.integrated,truePeak:measured.truePeak}]);}
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
  <div className="rcs-os-toolbar" aria-label="Рабочее пространство Radio OS">
   <div className="rcs-os-presets"><span>Рабочее пространство</span>{[['air','Эфир'],['editor','Редактор'],['monitoring','Мониторинг']].map(([id,label])=><button key={id} type="button" onClick={()=>applyPreset(id)}>{label}</button>)}</div>
   <button type="button" className={layoutEditing?'rcs-os-edit-active':''} onClick={()=>setLayoutEditing(v=>!v)} aria-pressed={layoutEditing}>{layoutEditing?'Готово':'Настроить панели'}</button>
  </div>
  {layoutEditing&&<p className="rcs-os-hint">Перетаскивайте панели за значок ⠿ на компьютере или используйте стрелки ↑ ↓. Изменения сохраняются автоматически.</p>}
  {layoutEditing&&<div className="rcs-os-restore"><span>Скрытые панели:</span>{RADIO_WIDGETS.filter(entry=>layout.hidden.includes(entry.id)).map(entry=><button key={entry.id} type="button" onClick={()=>patchLayout(previous=>({...previous,hidden:previous.hidden.filter(id=>id!==entry.id)}))}>+ {entry.name}</button>)}{!layout.hidden.length&&<span>Нет</span>}<button type="button" onClick={()=>applyPreset('air')}>Сбросить расположение</button></div>}
  <div className="rcs-grid rcs-os-grid">
   {widget('onair',<>
   <section className="rcs-onair">
    <div className="rcs-onair-top"><span className="rcs-eyebrow">● СЕЙЧАС В ЭФИРЕ</span><span className="rcs-source">{results.metadata?sourceName[source]||source:'Источник неизвестен'}</span><span className="rcs-onair-indicator">{running?'ON AIR':'НЕ ПОДТВЕРЖДЕНО'}</span></div>
    <div className="rcs-track">
     <div className={'rcs-cover rcs-cover-interactive '+(playing?'is-playing':'')}>
      <span aria-hidden="true">♫</span>
      <button className="rcs-cover-play" type="button" disabled={playerBusy} onClick={()=>void togglePlayback()}
       aria-label={playing?'Остановить прослушивание эфира':'Слушать эфир'} title={playing?'Пауза':'Слушать эфир'}>
       {reconnecting||playerBusy?'…':playing?'Ⅱ':'▶'}
      </button>
      <span className="rcs-cover-live">{playing?'● СЛУШАЕТЕ':'LIVE'}</span>
     </div>
     <div className="rcs-track-main"><p className="rcs-eyebrow">ФАКТИЧЕСКИЕ МЕТАДАННЫЕ PCM</p><h2>{formatTrack}</h2>
      <p>{metadata?.slot?.name||metadata?.slot?.playlist?.name||'Политех-FM'}</p>
      <div className="rcs-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Позиция текущей записи"><span style={{width:progress+'%'}}/></div>
      <div className="rcs-time"><span>{totalMs?duration(playMs):'—'}</span><span>{totalMs?duration(totalMs):'—'}</span></div>
      <small>Прогресс расчётный по данным Worker; не подтверждает слышимый сигнал на удалённом устройстве.</small>
     </div>
    </div>
    <audio ref={audioRef} {...audioEvents} preload="none" src="/api/radio-agent/listen" onPlaying={()=>setLastPlaying(Date.now())} aria-label="MP3-поток Политех-FM"/>
    <div className="rcs-cover-player-status" role="status">{reconnecting?'Переподключаем поток…':playing?'● Контрольное прослушивание активно':playbackError?'Ошибка прослушивания: '+playbackError:'Нажмите Play на обложке для прослушивания'}</div>
    <div className="rcs-onair-footer"><span>Следующее по плану: {fmt(upcoming[0]?.startAt||planned[0]?.startAt)}</span><div><button type="button" onClick={()=>onOpen('schedule')}>Сетка ↗</button><button type="button" onClick={()=>onOpen('history')}>Техмониторинг ↗</button></div></div>
   </section>
   </>)}
   {widget('queue',<>
   <Panel title="Далее в эфире" extraClass="rcs-queue" action={<button type="button" onClick={()=>setQueueOpen(x=>!x)} aria-expanded={queueOpen}>{queueOpen?'Свернуть':'Развернуть'}</button>}>
    <div className="rcs-tabs" role="tablist" aria-label="Тип очереди"><button type="button" role="tab" aria-selected={tab==='tracks'} className={tab==='tracks'?'selected':''} onClick={()=>setTab('tracks')}>Ближайшие передачи</button><button type="button" role="tab" aria-selected={tab==='grid'} className={tab==='grid'?'selected':''} onClick={()=>setTab('grid')}>Сетка</button></div>
    {queueOpen&&(tab==='tracks'?<RadioUpcomingQueue entries={upcoming} token={token} onSchedule={()=>onOpen('schedule')} onPlaylists={()=>onOpen('playlists')}/>:<div className="rcs-schedule-items">{planned.map(s=><button type="button" key={s.id} onClick={()=>onOpen('schedule')}><span>{fmt(s.startAt)}</span><strong>{s.title||s.name||s.playlist?.name||'Передача'}</strong><span>↗</span></button>)}{!planned.length&&<p>Нет предстоящих событий в загруженной сетке.</p>}</div>)}
    <p className="rcs-disclaimer">Очередь отображает утверждённый план, а не ручное управление текущим PCM.</p>
   </Panel>
   </>)}
   {widget('lufs',<>
       <aside className="rcs-lufs rcs-server-lufs rcs-lufs-vertical rcs-meter-panel" aria-label="Серверный измеритель громкости">
     <div className="rcs-lufs-title"><strong>Уровень эфира · EBU R128</strong><span>Серверный MP3</span></div>
     <div className="rcs-meter-row">
      {[
       ['LUFS-M','momentary',loudness?.momentary,'LUFS',-60,0],
       ['LUFS-I','integrated',loudness?.integrated,'LUFS',-60,0],
       ['True Peak','truePeak',loudness?.truePeak,'dBTP',-40,3]
      ].map(([label,key,value,unit,min,max])=>{
       const valid=loudness?.status==='RUNNING'&&!loudness.stale&&Number.isFinite(value);
       const percent=valid?Math.max(0,Math.min(100,(value-min)/(max-min)*100)):0;
       return <div className="rcs-meter" key={key}>
        <strong className="rcs-meter-label">{label}</strong>
        <div className="rcs-meter-gauge" role="meter" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={valid?value:undefined} aria-valuetext={valid?value.toFixed(1)+' '+unit:'Нет данных'}>
         <span className="rcs-meter-grid"/>
         <span className="rcs-meter-fill" style={{height:percent+'%'}}/>
        </div>
        <strong className="rcs-meter-number">{valid?value.toFixed(1):'—'}</strong>
        <span className="rcs-meter-unit">{unit}</span>
       </div>;
      })}
     </div>
     <p className="rcs-meter-state" role="status">{!results.worker?'Нет связи с PCM Worker':!loudness?'Сервер не передал loudness. Проверьте перезапуск Worker после обновления.':loudness.status==='DISABLED'?'Измеритель отключён (RADIO_LUFS_ENABLED=false).':loudness.status==='OVERLOADED'?'Анализатор перегружен: '+(loudness.lastError||'нет подробностей'):loudness.status==='UNAVAILABLE'?'FFmpeg-анализатор недоступен: '+(loudness.lastError||'неизвестная ошибка'):loudness.stale?'Показания устарели. Последний замер: '+(loudness.updatedAt||'нет'):loudness.status==='STARTING'?'Анализатор запускается; получено MP3-частей: '+(loudness.receivedChunks??0):'Серверный замер активен; данные MP3 после кодирования.'}</p>
    </aside>
   </>)}
   {widget('sources',<>
   <Panel title="Источники и управление" extraClass="rcs-sources" action={<button type="button" onClick={()=>onOpen('automation')}>Автоматизация ↗</button>}>
    <div className="rcs-status-grid">
     <Status title="Основной источник" state={results.metadata?running:null} detail={results.metadata?sourceName[source]||source:'Нет телеметрии'} onClick={()=>onOpen('automation')}/>
     <Status title="Эфирная сетка" state={results.report?Boolean(report?.cursor):null} detail={report?.cursor?.status||'Нет состояния курсора'} onClick={()=>onOpen('schedule')}/>
     <Status title="PCM Worker" state={results.worker?true:null} detail={results.worker?'Данные получены':'Нет ответа Worker'} onClick={()=>onOpen('history')}/>
     <Status title="Поток" state={results.report?Boolean(report?.stream):null} detail={report?.stream?.status||'Нет отчёта сервера'} onClick={()=>onOpen('history')}/>
    </div>
   </Panel>
   </>)}
   {widget('diagnostics',<>
   <Panel title="Диагностика и мониторинг" extraClass="rcs-diagnostics" action={<button type="button" onClick={()=>onOpen('history')}>Открыть мониторинг ↗</button>}>
    <div className="rcs-status-grid">
     <Status title="Playout Worker" state={results.worker?true:null} detail={results.worker?'Телеметрия отвечает':'Данные недоступны'}/>
     <Status title="Windows Radio Agent" state={!results.health||!health?.agents?.registered?null:health.agents.online>0} detail={!results.health?'Мониторинг устройств недоступен':!health?.agents?.registered?'Нет зарегистрированных агентов':health.agents.online+' из '+health.agents.registered+' на связи · TTL '+Math.round(health.agents.ttlMs/1000)+' с'} onClick={()=>onOpen('equipment')}/>
     <Status title="ESP32 · усилитель" state={!results.health?null:health?.amplifier?.connection==='ONLINE'} detail={!results.health?'Нет телеметрии усилителя':(health.amplifier.connection==='ONLINE'?'На связи':'Нет связи')+' · Реле: '+(health.amplifier.physicalRelay||'UNKNOWN')} onClick={()=>onOpen('equipment')}/>
     <Status title="Кроссфейды" state={worker?.transitions?worker.transitions.crossfadeFailed===0:null} detail={worker?.transitions?'Неудачных: '+(worker.transitions.crossfadeFailed??'—'):'Метрики недоступны'}/>
    </div>
    {results.health&&health?.agents?.agents?.length>0&&<div className="rcs-agent-list" aria-label="Состояние радиокомпьютеров">
     {health.agents.agents.filter(a=>a.status!=='REVOKED').map(agent=><div key={agent.id} className="rcs-agent-row">
      <span className={'rcs-led '+(agent.status==='ONLINE'?'ok':agent.status==='OFFLINE'?'bad':'unknown')}/>
      <strong>{agent.name||'Windows Radio Agent'}</strong>
      <span>{agent.status==='ONLINE'?'Связь есть':agent.status==='OFFLINE'?'Связь потеряна':'Ещё не подключался'}</span>
      <small>{agent.ageMs===null?'Нет heartbeat':'Последний запрос '+Math.floor(agent.ageMs/1000)+' с назад'}</small>
     </div>)}
    </div>}
    {results.health&&((health?.agents?.offline||0)>0||health?.amplifier?.connection==='OFFLINE')&&<p className="rcs-health-warning" role="alert">Внимание: {health.agents.offline||0} радиокомпьютеров без связи{health.amplifier.connection==='OFFLINE'?', усилитель ESP32 недоступен':''}. Проверить оборудование ↗</p>}
    <button type="button" className="rcs-details-toggle" aria-expanded={details} onClick={()=>setDetails(v=>!v)}>{details?'Скрыть сведения':'Подробности подключения'}</button>
    {details&&<div className="rcs-expanded"><p>Последняя проверка: {loadedAt?clock(loadedAt):'—'} · Интервал: 10 с</p><p>Источники: Worker {stateText(results.worker)} · Радио {stateText(results.metadata)} · ESP32 {stateText(results.amp)}</p></div>}
    <div className="rcs-diagnostics-amp"><h3>Управление усилителем</h3><RadioAmplifierControl token={token}/></div>
   </Panel>
   </>)}
   {widget('actions',<>
   <Panel title="Быстрые действия" extraClass="rcs-actions">
    <div className="rcs-action-grid">{[['▦','Открыть сетку','schedule'],['☷','Плейлисты','playlists'],['♫','Медиатека','assets'],['⚙','Автоматизация','automation'],['▥','Мониторинг','history'],['▣','Оборудование','equipment']].map(([icon,label,id])=><button key={id} type="button" onClick={()=>onOpen(id)}><span>{icon}</span><strong>{label}</strong><span>↗</span></button>)}</div>
   </Panel>
   </>)}
  </div>
 </div>;
}
