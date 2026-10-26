import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

export default function SafetyConsole() {
  const { token } = useAuth();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api('/safety/dashboard', { token }).then(r => { if (live) setStatus(r); }).catch(e => { if (live) setError(e.status === 403 ? 'Нет прав на просмотр пульта безопасности' : e.message); });
    return () => { live = false; };
  }, [token]);
  return <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-5 text-slate-900 dark:text-white">
    <h1 className="text-2xl font-bold">🛡️ Пульт безопасности</h1>
    <p className="text-sm text-slate-500 dark:text-white/60">Панель ответственного за безопасность. Управление реальным оповещением пока не реализовано.</p>
    {error && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-red-600 dark:text-red-300">{error}</p>}
    {!status && !error && <p role="status">Проверка прав и состояния…</p>}
    {status && <>
      <div className="rounded-2xl border border-amber-400/40 bg-amber-100/60 p-5 text-amber-950 dark:bg-amber-400/10 dark:text-amber-100">
        <strong>ТЕСТОВЫЙ РЕЖИМ — никаких команд в эфир</strong>
        <p className="mt-2 text-sm">Ручной приём наблюдений из Android проверен; постоянная доставка и статус источника пока не подтверждены. Не используйте эту страницу для принятия оперативных решений об эвакуации.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5"><p className="text-sm opacity-60">Источник</p><p className="font-semibold mt-2">{status.integration?.deliveryVerified ? 'Историческая доставка из Android подтверждена' : 'События Android не поступали'}</p></div>
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5"><p className="text-sm opacity-60">Оповещение</p><p className="font-semibold mt-2">Выключено</p></div>
      </div>
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5"><h2 className="font-semibold">Полученные предупреждения</h2><p className="text-sm opacity-60 mt-2">В базе: {status.eventCount ?? 0} записей. Приёмник: {status.integration?.receiverConfigured ? 'включён' : 'выключен'}. Автоматическая доставка Android не подтверждена.</p>
        <div className="mt-3 space-y-2">{status.events?.map(event => <div key={event.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
          <div className="text-xs opacity-60">Получено сервером: {new Date(event.receivedAt).toLocaleString('ru-RU')} · {event.verified ? 'Проверено оператором' : 'Не подтверждено независимо'}</div>
          <p className="text-xs opacity-60 mt-1">Время уведомления Android: {event.occurredAt ? new Date(event.occurredAt).toLocaleString('ru-RU') : 'не указано'} · {event.occurredAt && Date.now() - new Date(event.occurredAt).getTime() > 30 * 60000 ? 'Историческая запись' : 'Наблюдение — актуальность не установлена'}</p>
          <p className="font-semibold mt-1 break-words">{event.title}</p><p className="text-sm mt-1 whitespace-pre-wrap break-words">{event.body}</p>
        </div>)}</div></div>
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
