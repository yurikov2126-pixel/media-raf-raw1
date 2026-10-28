import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../api/client.js';

const labels = {
  OBSERVED: 'Ожидает анализа', ANALYZED: 'Проанализировано',
  INITIAL_INGEST: 'Получено от Android', CLASSIFIED_UNVERIFIED: 'Тип распознан, источник не подтверждён',
  UNCLASSIFIED: 'Неизвестный тип', STALE_OBSERVATION: 'Устаревшее уведомление',
  UNKNOWN_TIME: 'Нет времени события', FUTURE_TIME: 'Время в будущем',
};
const fmt = value => value ? new Date(value).toLocaleString('ru-RU') : '—';

export default function MchsQueueMonitor({ token }) {
  const [queue, setQueue] = useState(null);
  const [health, setHealth] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [selected, setSelected] = useState('');
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const [items, status, transport] = await Promise.all([
        api('/safety/observation-queue?limit=50', { token }),
        api('/safety/observation-analyzer/status', { token }),
        api('/safety/delivery-diagnostics', { token }),
      ]);
      setQueue(items); setHealth(status); setDelivery(transport); setLastRefresh(new Date()); setError('');
    } catch (e) { setError(e.message || 'Ошибка загрузки'); }
  }, [token]);
  useEffect(() => {
    let active = true;
    const run = () => { if (active && !document.hidden) void refresh(); };
    run();
    const timer = setInterval(run, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [refresh]);
  useEffect(() => {
    if (!selected) { setHistory(null); return; }
    let active = true;
    setHistory(null);
    api('/safety/observation-queue/' + encodeURIComponent(selected) + '/history', { token })
      .then(data => { if (active) setHistory(data.items || []); })
      .catch(e => { if (active) setError(e.message || 'Не удалось загрузить историю'); });
    return () => { active = false; };
  }, [selected, token]);
  const analyze = async () => {
    setBusy(true);
    try {
      await api('/safety/observation-queue/analyze', { token, method:'POST', body: {} });
      await refresh();
      if (selected) {
        const data = await api('/safety/observation-queue/' + encodeURIComponent(selected) + '/history', { token });
        setHistory(data.items || []);
      }
    } catch (e) { setError(e.message || 'Ошибка обработки'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 sm:p-5 space-y-4" aria-label="Мониторинг очереди МЧС">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-lg font-semibold">Очередь МЧС · диагностика</h3>
        <p className="text-sm text-slate-500 dark:text-white/60">Анализ уведомлений не подтверждает официальную тревогу и не запускает оповещение.</p></div>
      <button type="button" onClick={() => void refresh()} className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-sm">Обновить</button>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {[
        ['Получено всего', queue?.total],
        ['Ожидает', queue?.pending],
        ['Проанализировано', queue?.analyzed],
        ['Фоновый анализатор', health?.healthy ? 'Работает' : health?.configured ? 'Нет подтверждения работы' : 'Выключен'],
      ].map(([title, value]) => <div key={title} className="rounded-xl border border-slate-200 dark:border-white/10 p-3 min-w-0">
        <p className="text-xs text-slate-500 dark:text-white/50">{title}</p>
        <p className="mt-1 text-base font-semibold break-words">{value ?? '—'}</p></div>)}
    </div>
    <p className="text-xs text-slate-500 dark:text-white/50">
      {lastRefresh ? 'Обновлено: ' + fmt(lastRefresh) : 'Загрузка…'} · Автообновление каждые 15 секунд при открытой вкладке.
      {health?.runtime?.lastSuccessAt && ' · Последняя успешная проверка: ' + fmt(health.runtime.lastSuccessAt)}
      {health?.runtime?.lastAttemptAt && ' · Последний запуск: ' + fmt(health.runtime.lastAttemptAt)}
      {health?.runtime?.lastError && ' · Ошибка: ' + health.runtime.lastError}
      {health?.runtime?.lastErrorAt && ' (' + fmt(health.runtime.lastErrorAt) + ')'}
      {health?.saved?.savedAt && ' · Сохранено в БД: ' + fmt(health.saved.savedAt)}
    </p>
    {error && <p role="alert" className="rounded-lg bg-red-500/10 text-red-700 dark:text-red-300 p-3 text-sm">{error}</p>}
    {queue?.pending > 0 && <button type="button" disabled={busy} onClick={analyze}
      className="rounded-xl border border-violet-400 px-3 py-2 text-sm text-violet-700 dark:text-violet-200 disabled:opacity-50">
      {busy ? 'Анализируем…' : 'Анализировать ожидающие (до 50)'}
    </button>}
    <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 space-y-2 text-sm">
      <h4 className="font-semibold">Доставка Android → API → очередь</h4>
      <div className="grid sm:grid-cols-2 gap-2">
        <p>Heartbeat Android: <strong>{delivery?.connection === 'HEARTBEAT_RECENT' ? 'Недавно получен' : delivery?.connection === 'HEARTBEAT_STALE' ? 'Устарел / связь не подтверждена' : 'Нет данных'}</strong></p>
        <p>Последний heartbeat: {fmt(delivery?.lastHeartbeatAt)}</p>
        <p>Последнее уведомление в API: {fmt(delivery?.lastReceivedAt)}</p>
        <p>Задержка последнего события: {delivery?.lastEventLagMs == null ? 'Неизвестна' : Math.round(delivery.lastEventLagMs/1000) + ' с'}</p>
        <p>Ожидают анализа: {delivery?.pending ?? '—'}</p>
        <p>Фоновая обработка: {delivery?.analyzerHealthy ? 'Последняя проверка успешна' : 'Нет свежего подтверждения'}</p>
      </div>
      <div className="border-t border-slate-200 dark:border-white/10 pt-2 space-y-1">
        <p className="font-medium">Телеметрия Android VM</p>
        {!delivery?.vmTelemetry?.available ? <p className="text-xs opacity-70">Android пока передаёт heartbeat без сведений о локальной очереди. Это не означает, что очередь пуста.</p> : <>
          <p>Данные VM: {delivery.vmTelemetry.telemetryFresh ? 'свежие' : 'устарели'} · обновлены {fmt(delivery.vmTelemetry.lastReportedAt)}</p>
          <p>Чтение Android SQLite: {delivery.vmTelemetry.snapshotOk === true ? 'Успешно' : delivery.vmTelemetry.snapshotOk === false ? 'Ошибка чтения' : 'Нет данных'} · Последний успешный снимок: {fmt(delivery.vmTelemetry.snapshotAt)}</p>
          <p>В локальной очереди: {delivery.vmTelemetry.queuedLocal ?? 'неизвестно'} · Неудачных отправок (счётчик VM): {delivery.vmTelemetry.failedSends ?? 'неизвестно'}</p>
          <p>Последняя успешная отправка с VM: {fmt(delivery.vmTelemetry.lastSentAt)}</p>
          <p>Ожидают повторной отправки: {delivery.vmTelemetry.retryPending ?? 'неизвестно'} · Следующая попытка: {fmt(delivery.vmTelemetry.nextRetryAt)}</p>
          <p>Диагностика очереди: {({CLEAR:'Нет ожидающих отправок',PENDING:'Есть ожидающие отправки',WARNING:'Повторная попытка существенно просрочена',UNKNOWN:'Недостаточно свежих данных'})[delivery.vmTelemetry.backlog?.state] || 'Нет данных'}</p>
          {delivery.vmTelemetry.telemetryFresh && delivery.vmTelemetry.retryPending > 0 && <p className="text-amber-700 dark:text-amber-300">Есть неподтверждённые отправки. Проверь журнал VM; это не подтверждение потери уведомления.</p>}
        </>}
      </div>
      <p className="text-xs text-slate-500 dark:text-white/50">Отсутствие новых уведомлений не является неисправностью. Heartbeat подтверждает только контакт Android с API, а не полноту доставки push или подлинность сообщений. Задержка вычисляется по времени внутри уведомления, если оно доступно.</p>
    </div>
    <div className="space-y-2">
      {!queue && !error && <p className="text-sm opacity-70">Загрузка очереди…</p>}
      {queue?.items?.length === 0 && <p className="text-sm opacity-70">Записей пока нет.</p>}
      {queue?.items?.map(item => <div key={item.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
        <div className="flex flex-wrap justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium break-words">{item.event?.title || 'Без заголовка'}</p>
            <p className="text-xs text-slate-500 dark:text-white/50 mt-1">{item.event?.eventType || 'Не распознано'} · {fmt(item.event?.receivedAt)}</p>
            <p className="text-xs text-slate-500 dark:text-white/50">{labels[item.status] || item.status} · Подлинность официального предупреждения не установлена</p>
          </div>
          <button type="button" aria-expanded={selected === item.id} onClick={() => setSelected(selected === item.id ? '' : item.id)}
            className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2 text-sm">
            {selected === item.id ? 'Скрыть историю' : 'История'}
          </button>
        </div>
        {selected === item.id && <div className="mt-3 border-t border-slate-200 dark:border-white/10 pt-3 space-y-2 text-sm">
          {history === null ? 'Загрузка…' : history.length ? history.map(entry =>
            <div key={entry.id} className="flex flex-wrap gap-x-3 gap-y-1">
              <time className="opacity-60">{fmt(entry.createdAt)}</time>
              <span className="font-medium">{labels[entry.status] || entry.status}</span>
              <span>{labels[entry.reason] || entry.reason}</span>
            </div>) : 'История отсутствует.'}
        </div>}
      </div>)}
    </div>
  </section>;
}
