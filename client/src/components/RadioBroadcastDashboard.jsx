import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const time = value => value ? new Date(value).toLocaleString('ru-RU', {
  timeZone: 'Europe/Moscow', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit',
}) : '—';
const duration = ms => {
  if (!Number.isFinite(ms)) return '—';
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;
};
const tone = ok => ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400';

export default function RadioBroadcastDashboard({token}) {
  const [report,setReport] = useState(null);
  const [error,setError] = useState('');
  const [worker,setWorker] = useState(null);
  const [updated,setUpdated] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const result = await api('/radio-agent/dashboard',{token});
      setReport(result);setError('');setUpdated(new Date());
      try { setWorker(await api('/radio-agent/dashboard/worker',{token})); } catch {setWorker(null);}
    } catch (e) {setError(e.message || 'Нет связи с мониторингом');}
  },[token]);
  useEffect(()=>{
    refresh();
    const timer = setInterval(refresh,5000);
    return ()=>clearInterval(timer);
  },[refresh]);
  const cursor=report?.cursor;
  const stream=report?.stream;
  const track=cursor?.track;
  const percentage=track ? Math.min(100,Math.max(0,track.offsetMs/track.durationMs*100)) : 0;
  const online=report?.devices?.filter(d=>d.lastSeenAt && Date.now()-new Date(d.lastSeenAt).getTime()<90000).length || 0;
  return <section className="space-y-4" aria-label="Вещательный Dashboard">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs uppercase tracking-widest opacity-60">Broadcast control</p>
        <h2 className="text-2xl font-semibold">Вещательный Dashboard</h2>
        <p className="text-sm opacity-60">Контроль сервера, эфира и приёмников · Москва (UTC+3)</p></div>
      <button type="button" onClick={refresh} className="rounded-xl border border-current/20 px-3 py-2 text-sm">Обновить ↻</button>
    </div>
    {error && <p role="alert" className="rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 p-3 text-sm">{error}</p>}
    <div className="rounded-2xl border border-current/10 bg-white/5 p-4 flex flex-wrap justify-between items-center gap-3">
      <div><h3 className="font-semibold">Единый серверный playout</h3>
        <p className="text-xs opacity-60">Отдельный worker · общий MP3-поток · тестовый режим</p></div>
      <div className="text-right"><p className={'font-semibold '+tone(!!worker)}>{worker ? ({SCHEDULED:'Вещание по сетке',AUTO_DJ:'Авто-DJ · музыка',SILENCE:'Тишина / ожидание',STARTING:'Запускается',ERROR:'Ошибка'}[worker.mode]||worker.mode) : 'Не запущен / нет связи'}</p>
      <p className="text-xs opacity-60">Приёмников: {worker?.connected ?? '—'} · Фреймов: {worker?.frames ?? '—'}</p></div>
      {worker?.lastError && <p className="w-full text-xs text-rose-600 dark:text-rose-400" role="alert">{worker.lastError}</p>}
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        ['Серверный курсор',cursor?.status==='SCHEDULED'?'В сетке':cursor?.status==='AUTO_DJ'?'Авто-DJ':'Нет передачи',!!report],
        ['Поток MP3 · пилот',stream?.status==='STREAMING'?'Передаётся':'Ожидание',stream?.status==='STREAMING'],
        ['HTTP-приёмники',String(stream?.listeners ?? '—')+' / '+(stream?.maxListeners??'—'),(stream?.listeners||0)>0],
        ['Радиокомпьютеры',String(online)+' онлайн из '+(report?.devices?.length??'—'),online>0]
      ].map(([title,value,ok])=><div key={title} className="rounded-2xl border border-current/10 bg-white/5 p-4 space-y-2">
        <p className="text-xs opacity-60">{title}</p><p className={'text-lg font-semibold '+tone(ok)}>{value}</p>
      </div>)}
    </div>
    <div className="grid lg:grid-cols-3 gap-3">
      <div className="lg:col-span-2 rounded-2xl border border-current/10 bg-white/5 p-5 space-y-4">
        <div className="flex justify-between items-center gap-3">
          <h3 className="font-semibold">Сейчас по сетке</h3>
          <span className="text-xs rounded-full border border-current/20 px-2 py-1">{cursor?.status==='SCHEDULED'?'PLAYOUT':'STANDBY'}</span>
        </div>
        <p className="text-2xl font-semibold">{cursor?.slot?.name || 'Передача не запланирована'}</p>
        <p className="opacity-70">{track?.name || 'В текущем слоте нет активного трека'}</p>
        <div>
          <div className="h-2 overflow-hidden bg-current/10 rounded-full">
            <div className="h-full bg-blue-500 transition-all" style={{width:percentage+'%'}} />
          </div>
          <div className="flex justify-between text-xs opacity-60 mt-2">
            <span>{track?duration(track.offsetMs):'—'}</span><span>{track?duration(track.durationMs):'—'}</span>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <p>Начало передачи: <strong>{time(cursor?.slot?.startAt)}</strong></p>
          <p>Окончание: <strong>{time(cursor?.slot?.endAt)}</strong></p>
        </div>
      </div>
      <div className="rounded-2xl border border-current/10 bg-white/5 p-5 space-y-3">
        <h3 className="font-semibold">Техническое состояние</h3>
        <p className="text-sm">Транспорт: <strong>{stream?.transport || '—'}</strong></p>
        <p className="text-sm">Аудиомикшер прямого эфира: <strong>пока отдельно</strong></p>
        <p className="text-sm">Усилитель: <strong>не подключён</strong></p>
        <p className="text-sm">Начало передачи потока: <strong>{time(stream?.startedAt)}</strong></p>
        <p className="text-sm">Обновлено: {updated ? updated.toLocaleTimeString('ru-RU') : '—'}</p>
        {stream?.lastError && <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">FFmpeg: {stream.lastError}</p>}
      </div>
    </div>
    <div className="grid lg:grid-cols-2 gap-3">
      <div className="rounded-2xl border border-current/10 p-5 space-y-3">
        <h3 className="font-semibold">Далее в эфире</h3>
        {report?.upcoming?.length ? report.upcoming.map(s=><div key={s.id} className="flex gap-3 justify-between border-b border-current/10 py-2 text-sm">
          <span className="min-w-0 truncate">{s.name}</span><span className="shrink-0 opacity-70">{time(s.startAt)}</span>
        </div>):<p className="text-sm opacity-60">Нет ближайших передач</p>}
      </div>
      <div className="rounded-2xl border border-current/10 p-5 space-y-3">
        <h3 className="font-semibold">Радиокомпьютеры</h3>
        {report?.devices?.length ? report.devices.map(d=>{
          const connected=d.lastSeenAt && Date.now()-new Date(d.lastSeenAt).getTime()<90000;
          return <div key={d.id} className="flex gap-3 justify-between border-b border-current/10 py-2 text-sm">
            <div className="min-w-0"><p className="font-medium truncate">{d.name}</p><p className="text-xs opacity-60">Последняя связь: {time(d.lastSeenAt)}</p></div>
            <span className={tone(connected)}>{connected?'На связи':'Неактивен'}</span>
          </div>;
        }):<p className="text-sm opacity-60">Устройства ещё не зарегистрированы</p>}
      </div>
    </div>
    <p className="text-xs opacity-60">Показатели обновляются каждые 5 секунд. «На связи» означает недавний запрос агента, а не подтверждение слышимого звука. Тестовый HTTP MP3 пока не заменяет автономный серверный эфир и не управляет усилителем.</p>
  </section>;
}
