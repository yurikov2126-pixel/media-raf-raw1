import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../store/auth.jsx';
import RadioUsbInputPanel from './RadioUsbInputPanel.jsx';
import RadioPrivateLiveMonitor from './RadioPrivateLiveMonitor.jsx';
import RadioStudioTrialChecklist from './RadioStudioTrialChecklist.jsx';

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
export default function RadioLiveStudio() {
  const { token } = useAuth();
  const [status, setStatus] = useState('Подключение…');
  const [state, setState] = useState({ live: false, listener: false });
  const [role, setRole] = useState(null);
  const [muted, setMuted] = useState(false);
  const [selectedInputId,setSelectedInputId]=useState(()=>{
    try{return localStorage.getItem('radio:studio:input-id')||'';}catch{return '';}
  });
  const [inputStream,setInputStream]=useState(null);
  const [privatePreviewUrl,setPrivatePreviewUrl]=useState(null);
  const [privatePreviewInfo,setPrivatePreviewInfo]=useState('');
  const previewUrlRef=useRef(null);
  const [uplinkInfo,setUplinkInfo]=useState('Тестовый uplink выключен');
  const [uplinkActive,setUplinkActive]=useState(false);
  const [health,setHealth]=useState(null);
  const [publicLivePending,setPublicLivePending]=useState(false);
  const [publicLiveError,setPublicLiveError]=useState('');
  const [handoverResult,setHandoverResult]=useState('Проверка переключения ещё не проводилась');
  const [handoverProposal,setHandoverProposal]=useState(null);
  const recorderRef=useRef(null);
  const uplinkRef=useRef(null);
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const audioRef = useRef(null);
  const roleRef = useRef(null);
  const stop = () => {
    setPublicLiveError('');
    if(previewUrlRef.current){URL.revokeObjectURL(previewUrlRef.current);previewUrlRef.current=null;}
    setPrivatePreviewUrl(null);
    uplinkRef.current?.close();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current=null;setUplinkActive(false);setUplinkInfo('Тестовый uplink остановлен');
    const socket = socketRef.current;
    socket?.emit('radio:studio:leave');
    peerRef.current?.close(); peerRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    setInputStream(null);
    if (audioRef.current) { audioRef.current.srcObject = null; audioRef.current.pause(); }
    roleRef.current = null; setRole(null); setMuted(false);
  };
  const makePeer = (socket, target) => {
    peerRef.current?.close();
    const pc = new RTCPeerConnection(ICE);
    peerRef.current = pc;
    pc.onicecandidate = event => {
      if (event.candidate) socket.emit('radio:studio:signal', {
        target, payload: { type: 'candidate', candidate: event.candidate.toJSON() },
      });
    };
    pc.ontrack = event => {
      if (audioRef.current) {
        audioRef.current.srcObject = event.streams[0];
        audioRef.current.play().catch(() => setStatus('Нажмите «Включить звук»'));
      }
    };
    pc.onconnectionstatechange = () => setStatus('WebRTC: ' + pc.connectionState);
    return pc;
  };
  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    const getHealth=()=>{if(!socket.connected)return;socket.timeout(3500).emit('radio:studio:health',(err,result)=>{
      if(err||!result?.ok){setHealth(null);return;}setHealth(result);
    });};
    socket.on('connect', () => { setStatus('Сервер подключён'); socket.emit('radio:studio:state', setState); getHealth(); });
    socket.on('connect_error', () => setError('Не удалось подключить канал студии'));
    socket.on('disconnect',()=>{setHealth(null);setUplinkActive(false);setHandoverProposal(null);});
    const healthTimer=setInterval(getHealth,2500);
    socket.on('radio:studio:uplink:ended', ({ reason } = {}) => {
      uplinkRef.current?.close();setUplinkActive(false);
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      setError(reason === 'UPLINK_LEASE_EXPIRED' ? 'Тестовый аудиоканал остановлен: истекло время ожидания ведущего' : 'Тестовый аудиоканал остановлен сервером');
    });
    socket.on('radio:studio:state', setState);
    socket.on('radio:studio:ended', () => { stop(); setStatus('Ведущий завершил эфир'); });
    socket.on('radio:studio:listener-left', () => { peerRef.current?.close(); peerRef.current = null; setStatus('Приёмник отключился'); });
    socket.on('radio:studio:listener', async ({ id }) => {
      if (roleRef.current !== 'presenter' || !streamRef.current) return;
      try {
        const pc = makePeer(socket, id);
        streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current));
        await pc.setLocalDescription(await pc.createOffer());
        socket.emit('radio:studio:signal', { target: id, payload: { type: 'offer', sdp: pc.localDescription } });
      } catch (e) { setError(e.message); }
    });
    socket.on('radio:studio:signal', async ({ from, payload }) => {
      try {
        let pc = peerRef.current;
        if (payload.type === 'offer' && roleRef.current === 'listener') {
          pc = makePeer(socket, from);
          await pc.setRemoteDescription(payload.sdp);
          await pc.setLocalDescription(await pc.createAnswer());
          socket.emit('radio:studio:signal', { target: from, payload: { type: 'answer', sdp: pc.localDescription } });
        } else if (payload.type === 'answer' && pc) {
          await pc.setRemoteDescription(payload.sdp);
        } else if (payload.type === 'candidate' && pc) {
          await pc.addIceCandidate(payload.candidate);
        }
      } catch (e) { setError('WebRTC: ' + e.message); }
    });
    return () => { clearInterval(healthTimer); uplinkRef.current?.close(); if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); socket.emit('radio:studio:leave'); socket.disconnect(); peerRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [token]);
  const start = async () => {
    setError('');
    const socket = socketRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(selectedInputId?{deviceId:{exact:selectedInputId}}:{}),
          echoCancellation:false,noiseSuppression:false,autoGainControl:false,
          channelCount:{ideal:2},
        }, video: false,
      });
      socket.emit('radio:studio:present', response => {
        if (!response?.ok) { stream.getTracks().forEach(t => t.stop()); setError(response?.error || 'Не удалось начать эфир'); return; }
        streamRef.current = stream;setInputStream(stream);
        stream.getAudioTracks().forEach(track=>track.addEventListener('ended',()=>{
          if(streamRef.current===stream){stop();setError('Аудиоустройство отключилось. Подключите микшер и начните новую сессию.');}
        },{once:true}));
        roleRef.current = 'presenter'; setRole('presenter'); setStatus('В эфире · ожидаем приёмник');
      });
    } catch (e) { setError('Микрофон недоступен: ' + e.message); }
  };
  const listen = () => {
    setError('');
    socketRef.current?.emit('radio:studio:listen', response => {
      if (!response?.ok) { setError(response?.error || 'Подключение не удалось'); return; }
      roleRef.current = 'listener'; setRole('listener'); setStatus('Ожидаем звуковой поток');
    });
  };
  const stopUplink = () => {
    uplinkRef.current?.close();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;setUplinkActive(false);setUplinkInfo('Тестовый uplink остановлен');
  };
  const publicLiveAction=(action)=>{
    const socket=socketRef.current;
    if(!socket?.connected)return setPublicLiveError('Нет связи с сервером');
    setPublicLivePending(true);setPublicLiveError('');
    socket.timeout(7000).emit('radio:studio:public-live:'+action,(err,result)=>{
      setPublicLivePending(false);
      if(err||!result?.ok){
        const reasons={PUBLIC_LIVE_DISABLED:'Публичный LIVE выключен в настройках сервера',ACTIVE_PRESENTER_REQUIRED:'Сначала запустите студию и передачу Opus',PCM_NOT_READY:'Ожидаем устойчивый поток PCM',SCHEDULE_HAS_PRIORITY:'Сейчас идёт передача по расписанию',WORKER_SWITCH_FAILED:'Worker не подтвердил переключение'};
        return setPublicLiveError(reasons[result?.reason]||result?.reason||'Таймаут переключения');
      }
      setHealth(prev=>prev?{...prev,publicLiveOnAir:action==='start'}:prev);
    });
  };
  const startUplink=()=>{
    const socket=socketRef.current,stream=streamRef.current;
    if(roleRef.current!=='presenter'||!stream)return setError('Сначала подключите ведущего');
    if(health?.opusEnabled===false)return setError('Серверный Opus uplink отключён. Администратор должен включить RADIO_BROWSER_OPUS_UPLINK_ENABLED на тестовом API.');
    if(health?.pilotEnabled===false)return setError('PCM-шлюз отключён. Для проверки серверного звука нужен RADIO_BROWSER_PCM_GATEWAY_ENABLED на API и RADIO_LIVE_PCM_INTAKE_ENABLED на Worker.');
    if(typeof MediaRecorder==='undefined'||!MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
      return setError('Этот браузер не поддерживает WebM/Opus');
    if (uplinkRef.current) return;
    socket.emit('radio:studio:uplink:start',response=>{
      if(!response?.ok)return setError(response?.error||'Тестовый uplink недоступен');
      // MediaRecorder emits continuously. Never silently discard data while an ACK is pending.
      // A bounded FIFO preserves WebM ordering; overflow or missing ACK stops the entire pilot.
      const maxPendingChunks = 8, ackTimeoutMs = 5000;
      const queue = [];
      let seq = 0, pending = false, closed = false, ackTimer = null;
      const close = () => {
        if (closed) return;
        closed = true;
        clearTimeout(ackTimer);
        queue.length = 0;
        uplinkRef.current = null;
        socket.emit('radio:studio:uplink:stop');
      };
      const fail = reason => {
        setError('Тестовый uplink остановлен: ' + reason);
        setUplinkActive(false);setUplinkInfo('Передача остановлена из-за ошибки');
        close();
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      };
      const drain = () => {
        if (closed || pending || !queue.length) return;
        if (!socket.connected) return fail('потеряно соединение с сервером');
        pending = true;
        const chunk = queue.shift();
        ackTimer = setTimeout(() => fail('сервер не подтвердил аудиоблок за 5 секунд'), ackTimeoutMs);
        socket.emit('radio:studio:uplink:chunk',{chunk,sequence:seq},ack=>{
          if (closed) return;
          clearTimeout(ackTimer);
          pending = false;
          if (!ack?.ok) return fail(ack?.reason || ack?.error || 'пакет отклонён');
          seq++;
          setUplinkInfo('Подтверждено блоков: '+seq+' · в очереди: '+queue.length+' (без выхода в эфир)');
          drain();
        });
      };
      uplinkRef.current = { close };
      try {
        const recorder = new MediaRecorder(stream,{mimeType:'audio/webm;codecs=opus'});
        recorderRef.current = recorder;
        recorder.ondataavailable = async event => {
          if (closed || !event.data.size) return;
          try {
            const chunk = await event.data.arrayBuffer();
            if (closed) return;
            if (chunk.byteLength > 128 * 1024) return fail('превышен размер аудиоблока');
            if (queue.length >= maxPendingChunks) return fail('переполнена очередь передачи');
            queue.push(chunk);
            drain();
          } catch (e) { fail(e.message); }
        };
        recorder.onerror = () => fail('ошибка MediaRecorder');
        recorder.onstop = () => { close(); recorderRef.current = null;setUplinkActive(false); setUplinkInfo('Тестовый uplink остановлен'); };
        recorder.start(250);setUplinkActive(true);
        setUplinkInfo('Тестовый uplink: передача WebM/Opus с контролем очереди');
      } catch (e) { fail(e.message); }
    });
  };
  const runHandoverCheck=(kind)=>{
    const socket=socketRef.current;
    if(!socket?.connected)return setHandoverResult('Нет соединения с сервером');
    if(kind==='verify'&&!handoverProposal)return setHandoverResult('Сначала выполните подготовку');
    const event=kind==='verify'?'radio:studio:handover:verify':'radio:studio:handover:prepare';
    const onResult=(err,response)=>{
      if(err||!response){setHandoverProposal(null);setHandoverResult('Проверка недоступна');return;}
      if(kind==='prepare')setHandoverProposal(response.ok?response.proposalId:null);
      if(kind==='verify')setHandoverProposal(null);
      setHandoverResult(response.ok?'Проверка успешно пройдена (только симуляция, эфир не переключён)':
        'Проверка отклонена: '+(response.reason||'нет данных'));
    };
    if(kind==='verify')socket.timeout(3500).emit(event,{proposalId:handoverProposal},onResult);
    else socket.timeout(3500).emit(event,onResult);
  };
  const requestPrivatePreview=()=>{
    const socket=socketRef.current;
    if(!socket?.connected)return setPrivatePreviewInfo('Нет подключения');
    setPrivatePreviewInfo('Запрашиваем последний фрагмент PCM...');
    socket.timeout(4000).emit('radio:studio:private-preview',(err,result)=>{
      if(err||!result?.ok)return setPrivatePreviewInfo('Фрагмент недоступен: '+(result?.reason||'таймаут'));
      try{
        const raw=atob(result.wavBase64),bytes=new Uint8Array(raw.length);
        for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
        const url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));
        if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current=url;setPrivatePreviewUrl(url);
        setPrivatePreviewInfo('Фрагмент '+result.durationMs+' мс. Только локальное прослушивание, не публичный эфир.');
      }catch{setPrivatePreviewInfo('Не удалось обработать WAV-фрагмент');}
    });
  };
  const toggleMute = () => {
    streamRef.current?.getAudioTracks().forEach(track => { track.enabled = muted; });
    setMuted(!muted);
  };
  return <section className="space-y-5">
    <div className="rounded-2xl border border-current/10 bg-slate-900 p-5 text-white sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[11px] uppercase tracking-[.2em] text-indigo-300">LIVE STUDIO / PILOT</p>
          <h2 className="mt-2 text-2xl font-bold">Эфирная студия</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Рабочий стол ведущего: USB-вход RØDECaster Duo, связь с сервером и приватный аудиомонитор.</p>
        </div>
        <span className="rounded-full bg-amber-400/15 px-3 py-2 text-xs font-semibold text-amber-200">Тестовый тракт · без школьной акустики</span>
      </div>
      <div className="mt-5 flex flex-wrap gap-3 text-xs">
        <span className="rounded-lg bg-white/10 px-3 py-2">Подключение: {status}</span>
        <span className="rounded-lg bg-white/10 px-3 py-2">Ведущий: {state.live?'подключён':'нет подключения'}</span>
        <span className="rounded-lg bg-white/10 px-3 py-2">PCM Worker: {health?.workerReachable?'доступен':'нет подтверждения'}</span>
      </div>
    </div>
    <RadioUsbInputPanel selectedId={selectedInputId} stream={inputStream} locked={role==='presenter'} onSelect={id=>{
      setSelectedInputId(id);
      try{if(id)localStorage.setItem('radio:studio:input-id',id);else localStorage.removeItem('radio:studio:input-id');}catch{ /* optional local preference */ }
    }}/>
    {error && <p role="alert" className="text-red-500">{error}</p>}
    {role==='presenter'&&health?.pilotEnabled===false&&<div role="alert" className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm">
      <strong>Серверное PCM-прослушивание пока недоступно.</strong> {health?.opusEnabled===false?'Opus uplink выключен на API.':'Opus-валидация может работать, но FFmpeg/PCM-шлюз выключен на API.'} Для включения нужен администратор сервера. Уровни L/R показывают только локальный звук микрофона.
    </div>}
    <div className="flex flex-wrap gap-2 rounded-xl border border-current/10 bg-white/60 p-4 dark:bg-slate-900/50">
      {!role && <><button type="button" onClick={start} disabled={state.live} className="rounded-xl bg-blue-600 text-white px-4 py-2">Начать эфир с микрофона</button>
        <button type="button" onClick={listen} disabled={!state.live || state.listener} className="rounded-xl border border-current/20 px-4 py-2">Принимать эфир на этом устройстве</button></>}
      {role === 'presenter' && <button type="button" className="rounded-xl border border-current/20 px-4 py-2" onClick={uplinkActive?stopUplink:startUplink} disabled={!uplinkActive&&health?.pilotEnabled===false} title={!uplinkActive&&health?.pilotEnabled===false?'Требуется настройка PCM-шлюза на сервере':undefined}>{uplinkActive?'Остановить тест Opus':'Тест передачи Opus'}</button>}
      {role === 'presenter' && <button type="button" onClick={toggleMute} className="rounded-xl border border-current/20 px-4 py-2">{muted ? 'Включить микрофон' : 'Выключить микрофон'}</button>}
      {role && <button type="button" onClick={stop} className="rounded-xl border border-red-500/30 px-4 py-2 text-red-500">Завершить тест</button>}
    </div>
    {role==='presenter'&&<p className="text-xs opacity-65">{uplinkInfo}. {health?.decoderRunning?'Декодированный PCM доступен только изолированному Worker; основной эфир не меняется.':'Без активного PCM-шлюза серверное прослушивание невозможно.'}</p>}
    <details className="rounded-xl border border-current/10 p-3">
      <summary className="cursor-pointer text-sm font-semibold">Техническая диагностика шлюза</summary>
      <div className="mt-3 space-y-2 rounded-lg bg-black/5 p-3 dark:bg-white/5" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-sm">Диагностика аудиошлюза</strong>
        <span className="text-xs opacity-70">Только наблюдение · не публичный эфир</span>
      </div>
      {!health ? <p className="text-sm opacity-70">Нет актуальных данных диагностики</p> : <>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <span>Ведущий: {health.transportConnected?'подключён':'не подключён'}</span>
          <span>Декодер: {health.decoderRunning?'работает':'остановлен'}</span>
          <span>PCM Worker: {health.workerReachable?'доступен':'не доступен'}</span>
          <span>Буфер симулятора: {Number.isFinite(health.bufferedMs)?health.bufferedMs+' мс':'нет данных'}</span>
          <span>Возраст PCM: {Number.isFinite(health.pcmAgeMs)?Math.round(health.pcmAgeMs)+' мс':'нет данных'}</span>
          <span>Расписание: {health.scheduleKnown===false?'нет данных':health.scheduledActive?'занято':'свободно'}</span>
          <span>Переключение эфира: запрещено</span>
        </div>
        <p className="text-xs opacity-70">Ограничения: {health.blockers?.length?health.blockers.join(' · '):'нет данных'}</p>
      </>}
      </div>
    </details>
    {role==='presenter'&&<details className="rounded-xl border border-current/10 p-3">
      <summary className="cursor-pointer text-sm font-semibold">Расширенная проверка переключений</summary>
      <div className="mt-3 space-y-2">
      <strong className="text-sm">Проверка переключения · без выхода в эфир</strong>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={()=>runHandoverCheck('prepare')} className="rounded-lg border border-current/20 px-3 py-2 text-sm">Подготовить переход</button>
        <button type="button" disabled={!handoverProposal} onClick={()=>runHandoverCheck('verify')} className="rounded-lg border border-current/20 px-3 py-2 text-sm disabled:opacity-40">Повторная проверка</button>
      </div>
      <p className="text-xs opacity-75" role="status">{handoverResult}</p>
      <p className="text-xs opacity-60">Это тест контрольной логики. Источник MP3, Auto-DJ и усилитель не переключаются.</p>
      </div>
    </details>}
    {role==='presenter'&&<section className="space-y-3 rounded-xl border-2 border-rose-500/30 p-4">
      <div className="flex items-center justify-between gap-2">
       <strong>Публичный эфир · MP3</strong>
       <span className={health?.publicLiveOnAir?'font-bold text-rose-500':'text-xs opacity-65'}>{health?.publicLiveOnAir?'● В ЭФИРЕ':'Auto-DJ / расписание'}</span>
      </div>
      <p className="text-sm opacity-75">Подключение микрофона само по себе не переключает слушателей. Переключение действует только после подтверждения Worker.</p>
      {!health?.publicLiveEnabled&&<p className="text-xs text-amber-600 dark:text-amber-400">Публичный LIVE не разрешён на сервере. Тестовый режим продолжает работать.</p>}
      <div className="flex flex-wrap gap-2">
       <button type="button" disabled={publicLivePending||!health?.publicLiveEnabled||!uplinkActive||health?.publicLiveOnAir} onClick={()=>publicLiveAction('start')} className="rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white disabled:opacity-40">● В эфир</button>
       <button type="button" disabled={publicLivePending||!health?.publicLiveOnAir} onClick={()=>publicLiveAction('stop')} className="rounded-xl border border-current/20 px-4 py-2 font-semibold disabled:opacity-40">Завершить эфир / Auto-DJ</button>
      </div>
      {publicLiveError&&<p role="alert" className="text-sm text-rose-500">{publicLiveError}</p>}
    </section>}
    <RadioStudioTrialChecklist health={health} role={role}/>
    <div className="grid gap-3 xl:grid-cols-2">
    {role==='presenter'&&<RadioPrivateLiveMonitor socket={socketRef.current} active={uplinkActive&&health?.decoderRunning===true}/>}
    {role==='presenter'&&<RadioPrivateLiveMonitor mode="mix" socket={socketRef.current} active={!!uplinkInfo&&!uplinkInfo.includes('остановлен')&&!uplinkInfo.includes('выключен')}/>}
    </div>
    {role==='presenter'&&<div className="space-y-2 rounded-xl border border-current/10 bg-white/50 p-4 dark:bg-slate-900/50">
      <strong className="text-sm">Приватное PCM-прослушивание · без выхода в эфир</strong>
      <p className="text-xs opacity-65">Запросите последний фрагмент реального входящего звука (до 1 секунды). Используйте наушники — возможна обратная связь через USB.</p>
      <button type="button" disabled={!uplinkActive||health?.decoderRunning!==true} onClick={requestPrivatePreview} className="rounded-lg border border-current/20 px-3 py-2 text-sm">Получить тестовый WAV-фрагмент</button>
      <p role="status" className="text-xs opacity-70">{privatePreviewInfo}</p>
      {privatePreviewUrl&&<audio src={privatePreviewUrl} controls className="w-full"/>}
    </div>}
    <audio ref={audioRef} autoPlay controls className="w-full"/>
    {role==='listener' && <button type="button" className="rounded-xl border border-current/20 px-4 py-2" onClick={()=>audioRef.current?.play().catch(e=>setError(e.message))}>Включить звук</button>}
    <p className="text-xs opacity-60">Нужен HTTPS и разрешение микрофона. В разных сетях прямое соединение может не установиться без TURN-сервера.</p>
  </section>;
}
