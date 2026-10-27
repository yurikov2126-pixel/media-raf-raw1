import { useEffect, useState } from 'react';
import MchsEventJournal from '../components/MchsEventJournal.jsx';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

export default function SafetyConsole() {
  const { token } = useAuth();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let live = true;
    let busy = false;
    const refresh = async () => {
      if (busy || !live) return;
      busy = true;
      try {
        const r = await api('/safety/dashboard', { token });
        if (live) { setStatus(r); setError(''); setNow(Date.now()); }
      } catch (e) {
        if (live) setError(e.status === 403 ? 'Нет прав на просмотр пульта безопасности' : e.message);
      } finally { busy = false; }
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => { live = false; clearInterval(interval); };
  }, [token]);
  const heartbeatAge = status?.source?.lastSeen ? now - new Date(status.source.lastSeen).getTime() : null;
  const sourceOnline = heartbeatAge !== null && heartbeatAge >= 0 && heartbeatAge < 180000 && status?.source?.listener === 'CONNECTED';
  return <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-5 text-slate-900 dark:text-white">
    <h1 className="text-2xl font-bold">🛡️ Пульт безопасности</h1>
    <p className="text-sm text-slate-500 dark:text-white/60">Панель ответственного за безопасность. Управление реальным оповещением пока не реализовано.</p>
    {error && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-red-600 dark:text-red-300">{error}</p>}
    {!status && !error && <p role="status">Проверка прав и состояния…</p>}
    {status && <>
      <div className="rounded-2xl border border-amber-400/40 bg-amber-100/60 p-5 text-amber-950 dark:bg-amber-400/10 dark:text-amber-100">
        <strong>ТЕСТОВЫЙ РЕЖИМ — никаких команд в эфир</strong>
        <p className="mt-2 text-sm">Поступление сообщений в журнал подтверждено; наличие свежего heartbeat не доказывает получение каждого push-уведомления. Не используйте эту страницу для принятия оперативных решений об эвакуации.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5"><p className="text-sm opacity-60">Android Listener</p><p className="font-semibold mt-2">{sourceOnline ? 'На связи · heartbeat получен' : 'Нет подтверждения текущей связи'}</p><p className="text-xs opacity-60 mt-1">Последний heartbeat: {status.source?.lastSeen ? new Date(status.source.lastSeen).toLocaleString('ru-RU') : 'не получен'}</p></div>
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5"><p className="text-sm opacity-60">Доставка в журнал</p><p className="font-semibold mt-2">{status.integration?.deliveryVerified ? 'Ручная доставка подтверждена' : 'Нет подтверждённых событий'}</p><p className="text-xs opacity-60 mt-1">Есть сообщения в журнале; автоматическую доставку проверяем наблюдением</p></div>
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5"><p className="text-sm opacity-60">Оповещение</p><p className="font-semibold mt-2">Выключено</p></div>
      </div>
      <MchsEventJournal events={status.events || []} total={status.eventCount || 0} />
      <section className="rounded-2xl border border-sky-400/40 p-5 space-y-3">
        <h2 className="font-semibold">Диагностические события — только TEST ONLY</h2>
        <p className="text-sm opacity-70">Изолированный журнал. Приём: {status?.diagnosticIngestEnabled ? 'включён' : 'выключен'}. Записей: {status?.diagnosticCount ?? 0}. Эти записи не являются предупреждениями МЧС и не запускают радио.</p>
        {status?.diagnosticEvents?.map(item => <div key={item.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-3 text-sm">
          <strong>ТЕСТ: диагностика приёмника</strong>
          <p className="opacity-70 break-all">{item.eventId} · {new Date(item.receivedAt).toLocaleString('ru-RU')}</p>
        </div>)}
      </section>
    </>}
  </div>;
}
