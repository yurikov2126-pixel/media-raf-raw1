import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../api/client.js';
import { useSearchParams } from 'react-router-dom';

const labels = {
  OBSERVED: 'Ожидает анализа', ANALYZED: 'Проанализировано',
  INITIAL_INGEST: 'Получено от Android', CLASSIFIED_UNVERIFIED: 'Тип распознан, источник не подтверждён',
  UNCLASSIFIED: 'Неизвестный тип', STALE_OBSERVATION: 'Устаревшее уведомление',
  UNKNOWN_TIME: 'Нет времени события', FUTURE_TIME: 'Время в будущем',
};
const fmt = value => value ? new Date(value).toLocaleString('ru-RU') : '—';

export default function MchsQueueMonitor({ token, view = 'overview' }) {
  const [searchParams] = useSearchParams();
  const selectedIncident = searchParams.get('incident');
  const [queue, setQueue] = useState(null);
  const [health, setHealth] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [incidents, setIncidents] = useState(null);
  const [selected, setSelected] = useState('');
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [busy, setBusy] = useState(false);
  const [probeResult, setProbeResult] = useState('');
  const [probing, setProbing] = useState(false);
  const [queueFilter, setQueueFilter] = useState('ALL');
  const [queryText, setQueryText] = useState('');
  const [incidentFilter, setIncidentFilter] = useState('ALL');
  const [incidentText, setIncidentText] = useState('');
  const [activeIncident, setActiveIncident] = useState(null);
  const visibleQueue = (queue?.items || []).filter(item =>
    (queueFilter === 'ALL' || item.status === queueFilter) &&
    [item.event?.title,item.event?.eventType,item.id].some(value=>String(value||'').toLocaleLowerCase('ru').includes(queryText.trim().toLocaleLowerCase('ru')))
  );
  const visibleIncidents = (incidents || []).filter(item =>
    (incidentFilter === 'ALL' || (incidentFilter === 'OPEN' ? !item.resolvedAt : Boolean(item.resolvedAt))) &&
    [item.kind,item.reason,item.id].some(value=>String(value||'').toLocaleLowerCase('ru').includes(incidentText.trim().toLocaleLowerCase('ru')))
  );
  const refresh = useCallback(async () => {
    try {
      const [items, status, transport, journal] = await Promise.all([
        api('/safety/observation-queue?limit=50', { token }),
        api('/safety/observation-analyzer/status', { token }),
        api('/safety/delivery-diagnostics', { token }),
        api('/safety/technical-incidents', { token }),
      ]);
      setQueue(items); setHealth(status); setDelivery(transport); setIncidents(journal.items || []); setLastRefresh(new Date()); setError('');
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
      <div><h3 className="text-lg font-semibold">{({overview:'Сводка диагностики',delivery:'Связь и доставка Android',queue:'Очередь обработки',incidents:'История технических неисправностей'})[view] || 'Диагностика МЧС'}</h3>
        <p className="text-sm text-slate-500 dark:text-white/60">Анализ уведомлений не подтверждает официальную тревогу и не запускает оповещение.</p></div>
      <div className="flex flex-wrap gap-2">
        {view === 'delivery' && <button type="button" disabled={probing} onClick={async()=>{
          setProbing(true);setProbeResult('');
          try {
            const result=await api('/safety/technical-notification-probe',{token,method:'POST',body:{}});
            setProbeResult(result.socketAvailable ? 'Тестовое уведомление сохранено и отправлено в Socket.IO. Проверьте колокольчик без перезагрузки.' : 'Тестовое уведомление сохранено, но Socket.IO недоступен.');
          }catch(e){setProbeResult(e.message || 'Ошибка диагностического теста');}
          finally{setProbing(false);}
        }} className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-sm disabled:opacity-50">Проверить Socket.IO</button>}
        <button type="button" onClick={() => void refresh()} className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-sm">Обновить</button>
      </div>
    </div>
    {view === 'incidents' && <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[
          ['Всего записей',incidents?.length ?? '—'],
          ['Не устранено',incidents ? incidents.filter(x=>!x.resolvedAt).length : '—'],
          ['Восстановлено',incidents ? incidents.filter(x=>Boolean(x.resolvedAt)).length : '—']
        ].map(([label,value])=><div key={label} className="rounded-xl border border-slate-200 dark:border-white/10 p-3 bg-slate-50 dark:bg-white/5">
          <p className="text-xs text-slate-500 dark:text-white/60">{label}</p><p className="text-xl font-semibold mt-1">{value}</p>
        </div>)}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input aria-label="Поиск неисправностей" placeholder="Поиск по типу, причине, ID" value={incidentText} onChange={e=>setIncidentText(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm" />
        <select aria-label="Статус неисправностей" value={incidentFilter} onChange={e=>setIncidentFilter(e.target.value)}
          className="rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm">
          <option value="ALL">Все статусы</option><option value="OPEN">Не устранено</option><option value="RESOLVED">Восстановлено</option>
        </select>
      </div>
      <p className="text-xs text-slate-500 dark:text-white/50">Показаны последние {incidents?.length ?? '—'} записей журнала. Фильтры действуют по загруженным данным. Это только технические неисправности, не официальные предупреждения.</p>
      {selectedIncident && incidents && !incidents.some(item=>item.id===selectedIncident) && <p className="text-sm">Запись из уведомления не найдена среди загруженных событий.</p>}
      {incidents && visibleIncidents.length===0 && <p className="rounded-xl border border-slate-200 dark:border-white/10 p-4 text-sm">Нет записей по выбранным условиям.</p>}
      <div className="space-y-2">
        {visibleIncidents.map(item=><button key={item.id} type="button" id={item.id===selectedIncident?'mchs-incident-selected':undefined}
          onClick={()=>setActiveIncident(item)}
          className={`w-full text-left rounded-xl border p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${item.id===selectedIncident?'border-amber-500 ring-2 ring-amber-400/50 bg-amber-50 dark:bg-amber-400/10':'border-slate-200 dark:border-white/10'}`}>
          <div className="flex flex-wrap justify-between gap-2 items-start">
            <strong className="text-sm sm:text-base">{({HEARTBEAT:'Нет heartbeat Android VM',SNAPSHOT:'Ошибка чтения Android SQLite',RETRY:'Просроченная повторная отправка',BACKLOG:'Длительное ожидание в очереди'})[item.kind]||item.kind}</strong>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.resolvedAt?'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200':'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'}`}>{item.resolvedAt?'Восстановлено':'Не устранено'}</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-white/60 mt-2">Начало: {fmt(item.openedAt)} · {item.resolvedAt?'Завершение: '+fmt(item.resolvedAt):'Ожидает восстановления'}</p>
          <p className="text-xs mt-1 text-slate-500 dark:text-white/60">Открыть подробности</p>
        </button>)}
      </div>
      {activeIncident && <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6" role="presentation"
        onMouseDown={e=>{if(e.target===e.currentTarget)setActiveIncident(null);}}>
        <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" aria-hidden="true" />
        <section role="dialog" aria-modal="true" aria-labelledby="mchs-incident-dialog-title"
          className="relative w-full max-w-xl max-h-[85dvh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-white/15">
          <div className="flex justify-between items-start gap-3">
            <h4 id="mchs-incident-dialog-title" className="text-lg font-semibold">Техническая неисправность</h4>
            <button type="button" onClick={()=>setActiveIncident(null)} aria-label="Закрыть" className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-1.5">Закрыть</button>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <p><strong>Тип:</strong> {activeIncident.kind}</p>
            <p><strong>Статус:</strong> {activeIncident.resolvedAt?'Восстановлено':'Не устранено'}</p>
            <p><strong>Причина:</strong> {activeIncident.reason}</p>
            <p><strong>Открыто:</strong> {fmt(activeIncident.openedAt)}</p>
            <p><strong>Закрыто:</strong> {fmt(activeIncident.resolvedAt)}</p>
            <p className="break-all text-xs opacity-70">ID: {activeIncident.id}</p>
            <p className="rounded-lg bg-slate-100 dark:bg-white/10 p-3">Это запись мониторинга технической инфраструктуры, а не подтверждённое предупреждение МЧС. Радиооповещение не запускается.</p>
          </div>
        </section>
      </div>}
    </div>}
    {(view === "overview" || view === "queue") && <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {[
        ['Получено всего', queue?.total],
        ['Ожидает', queue?.pending],
        ['Проанализировано', queue?.analyzed],
        ['Фоновый анализатор', health?.healthy ? 'Работает' : health?.configured ? 'Нет подтверждения работы' : 'Выключен'],
      ].map(([title, value]) => <div key={title} className="rounded-xl border border-slate-200 dark:border-white/10 p-3 min-w-0">
        <p className="text-xs text-slate-500 dark:text-white/50">{title}</p>
        <p className="mt-1 text-base font-semibold break-words">{value ?? '—'}</p></div>)}
    </div>}
    <details className="text-xs text-slate-500 dark:text-white/50">
      <summary className="cursor-pointer font-medium">Технические подробности анализатора</summary>
      <div className="mt-2 space-y-1">
        {health?.runtime?.lastSuccessAt && <p>Последняя успешная проверка: {fmt(health.runtime.lastSuccessAt)}</p>}
        {health?.runtime?.lastAttemptAt && <p>Последний запуск: {fmt(health.runtime.lastAttemptAt)}</p>}
        {health?.runtime?.lastError && <p className="text-red-700 dark:text-red-300">Ошибка: {health.runtime.lastError}</p>}
        {health?.runtime?.lastErrorAt && <p>Время ошибки: {fmt(health.runtime.lastErrorAt)}</p>}
        {health?.saved?.savedAt && <p>Сохранено в БД: {fmt(health.saved.savedAt)}</p>}
      </div>
    </details>
    <p className="text-xs text-slate-500 dark:text-white/50">
      {lastRefresh ? 'Обновлено: ' + fmt(lastRefresh) : 'Загрузка…'} · Автообновление каждые 15 секунд при открытой вкладке.

    </p>
    {error && <p role="alert" className="rounded-lg bg-red-500/10 text-red-700 dark:text-red-300 p-3 text-sm">{error}</p>}
    {view === "queue" && queue?.pending > 0 && <button type="button" disabled={busy} onClick={analyze}
      className="rounded-xl border border-violet-400 px-3 py-2 text-sm text-violet-700 dark:text-violet-200 disabled:opacity-50">
      {busy ? 'Анализируем…' : 'Анализировать ожидающие (до 50)'}
    </button>}
    {(view === "overview" || view === "delivery") && <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 space-y-2 text-sm">
      <h4 className="font-semibold">Доставка Android → API → очередь</h4>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
        {[
          ['Связь с Android', delivery?.connection==='HEARTBEAT_RECENT'?'Связь подтверждена':delivery?.connection==='HEARTBEAT_STALE'?'Нет свежего heartbeat':'Нет данных'],
          ['SQLite Android', delivery?.vmTelemetry?.snapshotOk===true?'Чтение успешно':delivery?.vmTelemetry?.snapshotOk===false?'Ошибка чтения':'Нет подтверждения'],
          ['Локальная очередь',delivery?.vmTelemetry?.telemetryFresh ? delivery.vmTelemetry.queuedLocal ?? '—':'Нет свежих данных'],
          ['Повторные отправки',delivery?.vmTelemetry?.telemetryFresh ? delivery.vmTelemetry.retryPending ?? '—':'Нет свежих данных'],
          ['Анализатор',delivery?.analyzerHealthy?'Работает':'Нет свежего подтверждения'],
          ['Последний heartbeat',fmt(delivery?.lastHeartbeatAt)]
        ].map(([title,value])=><div key={title} className="min-w-0 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3">
          <p className="text-xs text-slate-500 dark:text-white/50">{title}</p>
          <p className="mt-1 font-semibold break-words">{value}</p>
        </div>)}
      </div>
      <details className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
        <summary className="cursor-pointer font-medium">Подробнее о доставке и задержках</summary>
        <div className="grid sm:grid-cols-2 gap-2 mt-3">
        <p>Heartbeat Android: <strong>{delivery?.connection === 'HEARTBEAT_RECENT' ? 'Недавно получен' : delivery?.connection === 'HEARTBEAT_STALE' ? 'Устарел / связь не подтверждена' : 'Нет данных'}</strong></p>
        <p>Последний heartbeat: {fmt(delivery?.lastHeartbeatAt)}</p>
        <p>Последнее уведомление в API: {fmt(delivery?.lastReceivedAt)}</p>
        <p>Задержка последнего события: {delivery?.lastEventLagMs == null ? 'Неизвестна' : Math.round(delivery.lastEventLagMs/1000) + ' с'}</p>
        <p>Ожидают анализа: {delivery?.pending ?? '—'}</p>
        <p>Фоновая обработка: {delivery?.analyzerHealthy ? 'Последняя проверка успешна' : 'Нет свежего подтверждения'}</p>
      </div>
      </details>
      <div className="border-t border-slate-200 dark:border-white/10 pt-3 space-y-1">
        <p className="font-medium">Телеметрия Android VM</p>
        {!delivery?.vmTelemetry?.available ? <p className="text-xs opacity-70">Android пока передаёт heartbeat без сведений о локальной очереди. Это не означает, что очередь пуста.</p> : <>
          <p>Данные VM: {delivery.vmTelemetry.telemetryFresh ? 'свежие' : 'устарели'} · обновлены {fmt(delivery.vmTelemetry.lastReportedAt)}</p>
          <p>Чтение Android SQLite: {delivery.vmTelemetry.snapshotOk === true ? 'Успешно' : delivery.vmTelemetry.snapshotOk === false ? 'Ошибка чтения' : 'Нет данных'} · Последний успешный снимок: {fmt(delivery.vmTelemetry.snapshotAt)}</p>
          <p>В локальной очереди: {delivery.vmTelemetry.queuedLocal ?? 'неизвестно'} · Неудачных отправок (счётчик VM): {delivery.vmTelemetry.failedSends ?? 'неизвестно'}</p>
          <p>Последняя успешная отправка с VM: {fmt(delivery.vmTelemetry.lastSentAt)}</p>
          <p>Самое старое ожидающее событие: {fmt(delivery.vmTelemetry.oldestPendingAt)} · возраст: {delivery.vmTelemetry.oldestPendingAgeMs == null ? 'неизвестен' : Math.floor(delivery.vmTelemetry.oldestPendingAgeMs/60000) + ' мин'}</p>
          {delivery.vmTelemetry.telemetryFresh && delivery.vmTelemetry.queuedLocal > 0 && delivery.vmTelemetry.oldestPendingAgeMs > 600000 && <p className="text-amber-700 dark:text-amber-300">Очередь содержит событие, ожидающее подтверждения более 10 минут.</p>}
          <p>Ожидают повторной отправки: {delivery.vmTelemetry.retryPending ?? 'неизвестно'} · Следующая попытка: {fmt(delivery.vmTelemetry.nextRetryAt)}</p>
          <p>Диагностика очереди: {({CLEAR:'Нет ожидающих отправок',PENDING:'Есть ожидающие отправки',WARNING:'Повторная попытка существенно просрочена',UNKNOWN:'Недостаточно свежих данных'})[delivery.vmTelemetry.backlog?.state] || 'Нет данных'}</p>
          {delivery.vmTelemetry.telemetryFresh && delivery.vmTelemetry.retryPending > 0 && <p className="text-amber-700 dark:text-amber-300">Есть неподтверждённые отправки. Проверь журнал VM; это не подтверждение потери уведомления.</p>}
        </>}
      </div>
      <p className="text-xs text-slate-500 dark:text-white/50">Отсутствие новых уведомлений не является неисправностью. Heartbeat подтверждает только контакт Android с API, а не полноту доставки push или подлинность сообщений. Задержка вычисляется по времени внутри уведомления, если оно доступно.</p>
    </div>}
    {view === "queue" && <div className="space-y-2">
      {!queue && !error && <p className="text-sm opacity-70">Загрузка очереди…</p>}
      {queue?.items?.length === 0 && <p className="text-sm opacity-70">Записей пока нет.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Поиск в очереди" placeholder="Поиск по названию или типу" value={queryText} onChange={e=>setQueryText(e.target.value)} className="w-full sm:w-auto min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent px-3 py-2 text-sm" />
        <label htmlFor="mchs-queue-filter" className="text-sm font-medium">Показать</label>
        <select id="mchs-queue-filter" value={queueFilter} onChange={e=>setQueueFilter(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
          <option value="ALL">Все события</option>
          <option value="OBSERVED">Ожидают анализа</option>
          <option value="ANALYZED">Проанализированы</option>
        </select>
        <span className="text-xs text-slate-500 dark:text-white/50">Фильтр по загруженным записям</span>
      </div>
      {visibleQueue.length===0 && queue?.items?.length>0 && <p className="text-sm opacity-70">По выбранному фильтру записей нет.</p>}
      {visibleQueue.map(item => <div key={item.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
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
    </div>}
  </section>;
}
