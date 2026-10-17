import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../store/auth.jsx';

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
export default function RadioLiveStudio() {
  const { token } = useAuth();
  const [status, setStatus] = useState('Подключение…');
  const [state, setState] = useState({ live: false, listener: false });
  const [role, setRole] = useState(null);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const audioRef = useRef(null);
  const roleRef = useRef(null);
  const stop = () => {
    const socket = socketRef.current;
    socket?.emit('radio:studio:leave');
    peerRef.current?.close(); peerRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
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
    socket.on('connect', () => { setStatus('Сервер подключён'); socket.emit('radio:studio:state', setState); });
    socket.on('connect_error', () => setError('Не удалось подключить канал студии'));
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
    return () => { socket.emit('radio:studio:leave'); socket.disconnect(); peerRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [token]);
  const start = async () => {
    setError('');
    const socket = socketRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      socket.emit('radio:studio:present', response => {
        if (!response?.ok) { stream.getTracks().forEach(t => t.stop()); setError(response?.error || 'Не удалось начать эфир'); return; }
        streamRef.current = stream; roleRef.current = 'presenter'; setRole('presenter'); setStatus('В эфире · ожидаем приёмник');
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
  const toggleMute = () => {
    streamRef.current?.getAudioTracks().forEach(track => { track.enabled = muted; });
    setMuted(!muted);
  };
  return <section className="space-y-4 rounded-2xl border border-current/10 p-5">
    <h2 className="text-xl font-bold">Эфирная студия · тест WebRTC</h2>
    <p className="text-sm opacity-70">Первый этап: один ведущий с микрофоном и один приёмник в браузере Mac. Только тестовые наушники, без усилителя и ESP32.</p>
    <p className="text-sm">Состояние: {status} · {state.live ? 'Ведущий в эфире' : 'Эфир свободен'}</p>
    {error && <p role="alert" className="text-red-500">{error}</p>}
    <div className="flex flex-wrap gap-2">
      {!role && <><button type="button" onClick={start} disabled={state.live} className="rounded-xl bg-blue-600 text-white px-4 py-2">Начать эфир с микрофона</button>
        <button type="button" onClick={listen} disabled={!state.live || state.listener} className="rounded-xl border border-current/20 px-4 py-2">Принимать эфир на этом устройстве</button></>}
      {role === 'presenter' && <button type="button" onClick={toggleMute} className="rounded-xl border border-current/20 px-4 py-2">{muted ? 'Включить микрофон' : 'Выключить микрофон'}</button>}
      {role && <button type="button" onClick={stop} className="rounded-xl border border-red-500/30 px-4 py-2 text-red-500">Завершить тест</button>}
    </div>
    <audio ref={audioRef} autoPlay controls className="w-full"/>
    {role==='listener' && <button type="button" className="rounded-xl border border-current/20 px-4 py-2" onClick={()=>audioRef.current?.play().catch(e=>setError(e.message))}>Включить звук</button>}
    <p className="text-xs opacity-60">Нужен HTTPS и разрешение микрофона. В разных сетях прямое соединение может не установиться без TURN-сервера.</p>
  </section>;
}
