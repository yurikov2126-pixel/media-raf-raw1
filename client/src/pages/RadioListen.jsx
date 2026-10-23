import {useEffect,useRef,useState} from 'react';
import {useRadioStreamRecovery} from '../hooks/useRadioStreamRecovery.js';
import {useRadioMetadataSync} from '../hooks/useRadioMetadataSync.js';
import './RadioListen.css';
import {RADIO_LIVE_DEFAULTS,normalizeRadioLiveDesign} from '../lib/radioLiveDesign.js';

const STREAM='/api/radio-agent/listen';
const clock=ms=>{const s=Math.max(0,Math.floor((ms||0)/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const modeLabel={AUTO_DJ:'Музыкальный эфир',SCHEDULED:'По сетке вещания',JINGLE:'Заставка',LIVE:'Прямое включение',SILENCE:'Ожидание эфира'};
const bars=Array.from({length:29},(_,i)=>({height:18+((i*19+7)%57),delay:(i%9)*-0.13,duration:0.65+(i%6)*0.13}));
function Waves({active}){return <div className={'rr-waves '+(active?'is-active':'')} aria-hidden="true">{bars.map((bar,i)=><span key={i} style={{'--h':bar.height+'%','--delay':bar.delay+'s','--duration':bar.duration+'s'}}/>)}</div>;}
export default function RadioListen(){
 const {audioRef,playing,error,reconnecting,audioEvents}=useRadioStreamRecovery();
 const {ingest,display:status,delay,waiting,setConfig}=useRadioMetadataSync(audioRef);
 const [metaError,setMetaError]=useState(false);
 const [design,setDesign]=useState(RADIO_LIVE_DEFAULTS);
 const [now,setNow]=useState(Date.now());
 const [volume,setVolume]=useState(0.85);
 const [muted,setMuted]=useState(false);
 const [busy,setBusy]=useState(false);
 const [sharing,setSharing]=useState(false);
 const [autoplayBlocked,setAutoplayBlocked]=useState(false);
 const mounted=useRef(true);
 useEffect(()=>{
  const audio=audioRef.current;
  if(!audio)return;
  // Audible autoplay is best-effort: Safari/Chrome may require a user gesture.
  audio.play().then(()=>setAutoplayBlocked(false)).catch(()=>setAutoplayBlocked(true));
 },[audioRef]);
 useEffect(()=>{
  let active=true;
  fetch('/api/radio-agent/listen/design',{cache:'no-store'}).then(res=>{if(!res.ok)throw Error('design unavailable');return res.json();})
   .then(value=>{if(active)setDesign(normalizeRadioLiveDesign(value));}).catch(()=>{});
  return()=>{active=false;};
 },[]);
 useEffect(()=>{
  let active=true;
  const refreshSync=async()=>{
   try{
    const response=await fetch('/api/radio-agent/listen/metadata-sync',{cache:'no-store'});
    if(response.ok){const value=await response.json();if(active)setConfig(value);}
   }catch{/* Retain last known calibration on network failure. */}
  };
  void refreshSync();
  const timer=setInterval(refreshSync,30000);
  return()=>{active=false;clearInterval(timer);};
 },[setConfig]);
 useEffect(()=>{
  mounted.current=true;
  let active=true;
  const refresh=async()=>{
   try{
    const response=await fetch('/api/radio-agent/listen/now-playing',{cache:'no-store'});
    if(!response.ok)throw new Error('metadata temporarily unavailable');
    const json=await response.json();
    if(active){ingest(json);setMetaError(false);}
   }catch{if(active)setMetaError(true);}
  };
  void refresh();
  const polling=setInterval(refresh,5000);
  const ticker=setInterval(()=>setNow(Date.now()),1000);
  return()=>{active=false;mounted.current=false;clearInterval(polling);clearInterval(ticker);};
 },[]);
 useEffect(()=>{if(audioRef.current){audioRef.current.volume=volume;audioRef.current.muted=muted;}},[volume,muted,audioRef]);
 const toggle=async()=>{
  const audio=audioRef.current;if(!audio||busy)return;
  if(playing){audio.pause();return;}
  setBusy(true);
  try{await audio.play();setAutoplayBlocked(false);}catch{setAutoplayBlocked(true);}
  finally{if(mounted.current)setBusy(false);}
 };
 const share=async()=>{
  const url=window.location.origin+'/radio/live';
  try{
   if(navigator.share)await navigator.share({title:'MEDIA · РАФ · RAW — прямой эфир',url});
   else if(navigator.clipboard){await navigator.clipboard.writeText(url);setSharing(true);setTimeout(()=>{if(mounted.current)setSharing(false);},2500);}
   else window.prompt('Ссылка на эфир',url);
  }catch{/* Share cancellation is not an error. */}
 };
 const track=status?.track;
 const mode=status?.mode;
 const title=mode==='LIVE'?'Прямой эфир':mode==='JINGLE'?'Фирменная заставка':track?.title||track?.name||'Музыка начинается здесь';
 const artist=track?.artist||'MEDIA · РАФ · RAW';
 const total=status?.playout?.durationMs||track?.durationMs||0;
 const rawElapsed=status?.playout?Math.max(0,(status.playout.seekMs||0)+(status.playout.emittedMs||0)):0;
 const observed=Number(status?.observedAt)||0;
 const elapsed=total?Math.max(0,Math.min(total,rawElapsed+(status?.playout&&observed?Math.max(0,Math.min(40000,now-observed)):0)-delay*1000)):0;
 const percent=total?Math.max(0,Math.min(100,elapsed/total*100)):0;
 const active=playing&&!reconnecting;
 const silence=mode==='SILENCE';
 const showStart=status?.nextShow?.startAt?Date.parse(status.nextShow.startAt):NaN;
 const untilShow=Number.isFinite(showStart)?Math.max(0,showStart-now):null;
 const showDate=Number.isFinite(showStart)?new Date(showStart).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):null;
 const tone=mode==='LIVE'?'live':mode==='JINGLE'?'jingle':'music';
 return <main className={'rr-live rr-tone-'+tone} style={{'--rr-admin-accent':design.accent,'--rr-admin-background':design.background,backgroundColor:design.background}}>
  <div className="rr-ambient rr-ambient-a" aria-hidden="true"/><div className="rr-ambient rr-ambient-b" aria-hidden="true"/>
  <div className="rr-shell">
   <header className="rr-header">
    <a href="/" className="rr-wordmark"><span className="rr-logo">R</span><span>MEDIA <i>·</i> РАФ <i>·</i> RAW<small>{design.headerSubtitle}</small></span></a>
    <div className="rr-header-actions"><span className="rr-onair"><span/> В ЭФИРЕ</span><a className="rr-back" href="/">На сайт <span aria-hidden="true">↗</span></a></div>
   </header>
   <div className="rr-content">
    <section className="rr-player" aria-label="Плеер прямого эфира">
     <div className="rr-player-top"><span className="rr-eyebrow">{design.eyebrow}</span><span className="rr-dots" aria-hidden="true">✦ ✦ ✦</span></div>
     <div className="rr-disc-area">
      <div className={'rr-halo '+(active?'rr-halo-active':'')} aria-hidden="true"/>
      <div className={'rr-disc '+(active?'rr-disc-playing':'')} aria-hidden="true"><div className="rr-disc-center"><span>MEDIA</span><strong>РАФ</strong><span>RAW</span></div></div>
      <div className="rr-disc-side-label" aria-hidden="true">ON AIR — 24/7</div>
     </div>
     <div className="rr-track-info" aria-live="polite">
      <div className="rr-track-tag"><span className="rr-tag-dot"/> {modeLabel[mode]||'Радио онлайн'}</div>
      <h1 title={title}>{title}</h1>
      <p title={artist}>{artist}</p>
     </div>
     {status?.currentShow&&status.currentShow.hosts?.length>0&&<div className="rr-presenters" aria-label="Ведущие передачи"><div className="rr-presenters-heading"><span className="rr-eyebrow">СЕЙЧАС В ЭФИРЕ</span><strong>{status.currentShow.name}</strong></div><div className="rr-presenters-list">{status.currentShow.hosts.map(host=><div className="rr-presenter" key={host.id}>{host.avatar?<img src={host.avatar} alt="" loading="lazy"/>:<span className="rr-presenter-avatar">🎙</span>}<span><strong>{host.fullName}</strong><small>Радиоведущий</small></span></div>)}</div></div>}
     {silence&&<div className="rr-next-show" role="status"><span className="rr-eyebrow">СКОРО В ЭФИРЕ</span>{showDate?<><strong>{status.nextShow.name}</strong><span>{showDate} · МСК{untilShow!==null&&untilShow>0?' · через '+(untilShow>=3600000?Math.floor(untilShow/3600000)+' ч ':'')+Math.ceil((untilShow%3600000)/60000)+' мин':''}</span></>:<span>Ближайших передач пока нет в расписании</span>}</div>}
     {waiting&&<p className="rr-meta-note">Собираем историю для компенсации задержки — первые секунды данные могут опережать звук.</p>}
     {design.showWaves&&<Waves active={active}/>}
     <div className="rr-progress" role="progressbar" aria-label="Прогресс текущей записи" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><div style={{width:percent+'%'}}/></div>
     <div className="rr-times"><span>{status?.playout?clock(elapsed):'—:—'}</span><span>{total?clock(total):'—:—'}</span></div>
     <div className="rr-controls">
      <div className="rr-volume"><button type="button" aria-label={muted?'Включить звук':'Выключить звук'} onClick={()=>setMuted(v=>!v)}>{muted||volume===0?'◌':'♫'}</button><input aria-label="Громкость" type="range" min="0" max="1" step="0.01" value={volume} onChange={e=>{setVolume(Number(e.target.value));setMuted(false);}}/></div>
      <button className="rr-play" type="button" onClick={toggle} disabled={busy} aria-label={playing?'Остановить эфир':'Слушать эфир'}><span aria-hidden="true">{playing?'Ⅱ':'▶'}</span></button>
      <button className="rr-share" type="button" onClick={share} aria-label="Поделиться эфиром" title="Поделиться эфиром">↗</button>
     </div>
     <audio ref={audioRef} {...audioEvents} preload="none" src={STREAM} aria-label="Аудиопоток MEDIA РАФ RAW"/>
     <div className="rr-status" role="status"><span className={'rr-status-dot '+(active?'active':reconnecting?'waiting':'')}/>{reconnecting?'Восстанавливаем соединение…':active?'Вы слушаете прямой эфир':busy?'Подключаемся…':autoplayBlocked?'Нажмите ▶, чтобы включить звук — браузер ограничил автозапуск':'Нажмите воспроизведение, чтобы слушать'}</div>
     {error&&<p className="rr-alert" role="alert">{error}</p>}
     {metaError&&<p className="rr-meta-note">Информация о композиции временно недоступна. Аудиопоток работает независимо.</p>}
     {sharing&&<p className="rr-copy-note" role="status">Ссылка скопирована!</p>}
    </section>
    <aside className="rr-side">
     <div className="rr-side-intro"><span className="rr-eyebrow">{design.stationTagline}</span><h2>{design.heroLine1}<br/><em>{design.heroLine2}</em><br/>{design.heroLine3}</h2><p>{design.description}</p></div>
     {design.showInvite&&<div className="rr-invite-card">
      <span className="rr-eyebrow">{design.inviteEyebrow}</span>
      <div className="rr-invite-art" aria-hidden="true"><span className="rr-invite-orbit rr-invite-orbit-a"/><span className="rr-invite-orbit rr-invite-orbit-b"/><span className="rr-invite-icon">♫</span></div>
      <h3>{design.inviteTitle}</h3>
      <p>{design.inviteDescription}</p>
      <button className="rr-invite-action" type="button" onClick={share}>{design.inviteButton} <span aria-hidden="true">↗</span></button>
     </div>}
     {design.showStationClock&&<div className="rr-side-footer">Москва · {new Date(now).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'})}</div>}
     {design.showSideFooter&&<div className="rr-side-footer"><span className="rr-footer-mark">✳</span><p>{design.sideFooter}</p></div>}
    </aside>
   </div>
   <footer className="rr-footer"><span>© MEDIA · РАФ · RAW</span><span>{design.footerText}</span></footer>
  </div>
 </main>;
}
