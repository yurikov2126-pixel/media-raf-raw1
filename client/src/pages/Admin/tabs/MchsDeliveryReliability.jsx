import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client.js';

const formatDate = value => {
  if (!value) return 'Нет данных';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Некорректное время' : date.toLocaleString('ru-RU');
};
const formatDuration = ms => {
  if (ms == null || !Number.isFinite(Number(ms)) || Number(ms) < 0) return 'Нет данных';
  const seconds = Math.round(Number(ms) / 1000);
  return seconds < 60 ? seconds + ' сек' : (seconds / 60).toFixed(1) + ' мин';
};
const diagnosticChecks = (delivery, incidentData, analytics) => {
  const vm = delivery?.vmTelemetry;
  const checks = [];
  if (!delivery) return checks;
  checks.push({
    key: 'heartbeat', title: 'Связь с Android VM',
    state: delivery.connection === 'HEARTBEAT_RECENT' ? 'ok' : 'attention',
    detail: delivery.connection === 'HEARTBEAT_RECENT' ? 'Недавний heartbeat' : 'Свежий heartbeat не подтверждён',
    explanation: 'Последний контакт: ' + formatDate(delivery.lastHeartbeatAt)
  });
  checks.push({
    key: 'telemetry', title: 'Свежесть телеметрии VM',
    state: vm?.telemetryFresh ? 'ok' : 'unknown',
    detail: vm?.telemetryFresh ? 'Есть свежая телеметрия' : 'Сведения об очереди могли устареть',
    explanation: 'Последний отчёт: ' + formatDate(vm?.lastReportedAt)
  });
  checks.push({
    key: 'backlog', title: 'Локальная очередь',
    state: !vm?.telemetryFresh || vm.queuedLocal == null ? 'unknown' : vm.queuedLocal > 0 ? 'attention' : 'ok',
    detail: !vm?.telemetryFresh || vm.queuedLocal == null ? 'Нет свежих данных' : vm.queuedLocal + ' ожидают отправки',
    explanation: 'Старейшая запись: ' + formatDate(vm?.oldestPendingAt)
  });
  checks.push({
    key: 'retries', title: 'Повторные отправки',
    state: !vm?.telemetryFresh || vm.retryPending == null ? 'unknown' : vm.retryPending ? 'attention' : 'ok',
    detail: !vm?.telemetryFresh || vm.retryPending == null ? 'Нет свежих данных' : vm.retryPending ? 'Ожидается повторная отправка' : 'Повтор не ожидается',
    explanation: 'Следующая попытка: ' + formatDate(vm?.nextRetryAt)
  });
  checks.push({
    key: 'sqlite', title: 'SQLite Android',
    state: vm?.snapshotOk === true ? 'ok' : vm?.snapshotOk === false ? 'attention' : 'unknown',
    detail: vm?.snapshotOk === true ? 'Чтение успешно' : vm?.snapshotOk === false ? 'Ошибка последней проверки' : 'Данных недостаточно',
    explanation: 'Последняя проверка: ' + formatDate(vm?.snapshotAt)
  });
  if (incidentData) checks.push({
    key: 'incidents', title: 'Технические инциденты',
    state: (incidentData.items || []).some(x => !x.resolvedAt) ? 'attention' : 'ok',
    detail: (incidentData.items || []).filter(x => !x.resolvedAt).length + ' открытых в загруженном журнале',
    explanation: 'Проверена выборка последних технических событий'
  });
  if (analytics?.limits?.truncated) checks.push({
    key: 'limit', title: 'Полнота аналитики', state: 'unknown',
    detail: 'Достигнут лимит выборки', explanation: 'Часть исторических записей не попала в выборку'
  });
  return checks;
};

export default function MchsDeliveryReliability({ token, compact = false, onOpen }) {
  const [days, setDays] = useState(7);
  const [alerts, setAlerts] = useState({items:[],checkedAt:null,error:'',loading:true});
  const [hours, setHours] = useState(24);
  const [history, setHistory] = useState({items:[],loading:true,error:'',truncated:false});
  const [state, setState] = useState({ delivery: null, analytics: null, incidents: null, updated: null, loading: true, error: '' });
  const refresh = useCallback(async () => {
    setState(previous => ({ ...previous, loading: true }));
    const results = await Promise.allSettled([
      api('/safety/delivery-diagnostics', { token }),
      api('/safety/analytics?days=' + days, { token }),
      api('/safety/technical-incidents', { token })
    ]);
    const [delivery, analytics, incidents] = results.map(result => result.status === 'fulfilled' ? result.value : null);
    const errors = results.map((result, index) => result.status === 'rejected' ? ['Доставка', 'Аналитика', 'Инциденты'][index] + ': ' + (result.reason?.message || 'Ошибка загрузки') : '').filter(Boolean);
    setState({ delivery, analytics, incidents, updated: new Date(), loading: false, error: errors.join('; ') });
  }, [token, days]);
  useEffect(() => {
    void refresh();
    if (compact) return undefined;
    const interval = setInterval(() => { if (!document.hidden) void refresh(); }, 30000);
    return () => clearInterval(interval);
  }, [refresh, compact]);
  useEffect(() => {
    let active = true;
    setHistory(previous => ({...previous,loading:true,error:''}));
    api('/safety/telemetry-history?hours=' + hours, { token }).then(result => {
      if(active)setHistory({items:result.items||[],truncated:Boolean(result.truncated),loading:false,error:''});
    }).catch(error => {
      if(active)setHistory({items:[],truncated:false,loading:false,error:error.message||'Ошибка загрузки истории'});
    });
    return () => {active=false;};
  }, [hours,token]);
  const telemetryPoints = history.items.filter(item => item.telemetryPresent);
  const graphValues = key => telemetryPoints.filter(item => typeof item[key] === 'number').map(item => ({time:item.receivedAt,value:item[key]}));
  const historyGraph = (key, label) => {
    const points = graphValues(key);
    const max = Math.max(1,...points.map(point=>point.value));
    return <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-2">
      <h5 className="font-semibold text-sm">{label}</h5>
      {points.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">Нет исторических измерений</p> :
        <div role="img" aria-label={label + ': измерения по сохранённым heartbeat'} className="h-32 flex items-end gap-px">
          {points.map((point,index)=><div key={index} title={new Date(point.time).toLocaleString('ru-RU') + ': ' + point.value}
            style={{height:Math.max(2,point.value/max*100)+'%'}} className="flex-1 min-w-0 rounded-t bg-violet-500/80 dark:bg-violet-400/80" />)}
        </div>}
      <p className="text-xs text-slate-600 dark:text-slate-300">Отчёты устройства; отсутствие измерений не равно нулю.</p>
    </div>;
  };
  useEffect(() => {
    let active=true;
    const load=async()=>{
      try {
        const result=await api('/safety/telemetry-alerts',{token});
        if(active)setAlerts({items:result.alerts||[],checkedAt:result.checkedAt,error:'',loading:false});
      } catch(error) {
        if(active)setAlerts(previous=>({...previous,error:error.message||'Не удалось проверить аномалии',loading:false}));
      }
    };
    void load();
    const timer=setInterval(()=>{if(!document.hidden)void load();},30000);
    return()=>{active=false;clearInterval(timer);};
  },[token]);
  const checks = useMemo(() => diagnosticChecks(state.delivery, state.incidents, state.analytics), [state.delivery, state.incidents, state.analytics]);
  const attention = checks.filter(check => check.state === 'attention');
  const unknown = checks.filter(check => check.state === 'unknown');
  const statuses = { ok: 'Сведения получены', attention: 'Проверьте', unknown: 'Неизвестно' };
  const daily = state.analytics?.series || [];
  const scale = Math.max(1, ...daily.map(day => day.messages || 0));
  const vm = state.delivery?.vmTelemetry;
  return <section aria-label="Надёжность доставки МЧС" className="mchs-panel rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-4 sm:p-5 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold">Контроль доставки Android → сервер</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Технический мониторинг: доступность, повторные отправки, накопление очереди и задержки.</p>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        {!compact && <select aria-label="Период надёжности доставки" value={days} onChange={event => setDays(Number(event.target.value))} className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-sm"><option value={7}>7 дней</option><option value={30}>30 дней</option><option value={90}>90 дней</option></select>}
        <button type="button" onClick={() => void refresh()} disabled={state.loading} className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-sm disabled:opacity-50">{state.loading ? 'Обновление…' : 'Обновить'}</button>
      </div>
    </div>
    {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}. Недоступные показатели не считаются исправными.</p>}
    <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h4 className="font-semibold">Автоматические технические проверки</h4>
        <span className="text-xs text-slate-600 dark:text-slate-300">Проверено: {formatDate(alerts.checkedAt)}</span>
      </div>
      {alerts.loading && <p className="text-sm">Загрузка проверок…</p>}
      {alerts.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{alerts.error}</p>}
      {!alerts.loading && !alerts.error && alerts.items.length===0 && <p className="text-sm">По сохранённой телеметрии срабатываний не обнаружено. Это не подтверждает полноту доставки.</p>}
      {alerts.items.map(item=><div key={item.code} className="rounded-lg border border-amber-300/70 dark:border-amber-700 p-3">
        <div className="flex flex-wrap gap-2 items-center justify-between"><strong className="text-sm">{item.title}</strong><span className="text-xs">{item.severity==='unknown'?'Нет свежих данных':'Требует внимания'}</span></div>
        <p className="text-sm mt-1">{item.detail}</p>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Начало признаков: {formatDate(item.since)} · {item.code}</p>
      </div>)}
      <p className="text-xs text-slate-600 dark:text-slate-300">Оценка обновляется раз в 30 секунд на открытой странице. Это текущие диагностические признаки, а не журнал подтверждённых тревог МЧС. Автоматический эфир не активируется.</p>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {[
        ['Требует проверки', attention.length],
        ['Неизвестный статус', unknown.length],
        ['Задержка последнего сообщения', formatDuration(state.delivery?.lastEventLagMs)],
        ['Неудачные отправки VM', vm?.telemetryFresh ? vm.failedSends ?? 'Нет данных' : 'Нет свежих данных']
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 p-3 min-w-0"><p className="text-xs text-slate-600 dark:text-slate-300">{label}</p><strong className="text-lg mt-1 block break-words">{value}</strong></div>)}
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {checks.map(check => <div key={check.key} className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-1">
        <div className="flex items-center justify-between gap-2"><h4 className="font-semibold text-sm">{check.title}</h4><span className="text-xs text-slate-600 dark:text-slate-300">{statuses[check.state]}</span></div>
        <p className="text-sm">{check.detail}</p>
        <p className="text-xs text-slate-600 dark:text-slate-300">{check.explanation}</p>
      </div>)}
    </div>
    {!compact && <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <h4 className="font-semibold">История телеметрии Android VM</h4>
          <select value={hours} onChange={event=>setHours(Number(event.target.value))} aria-label="Период истории телеметрии"
            className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2 text-sm bg-white dark:bg-slate-900">
            <option value={24}>24 часа</option><option value={72}>3 дня</option><option value={168}>7 дней</option>
          </select>
        </div>
        {history.loading && <p className="text-sm">Загрузка истории…</p>}
        {history.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{history.error}</p>}
        {history.truncated && <p className="text-sm text-amber-800 dark:text-amber-200">Выборка ограничена 3000 записями; графики могут быть неполными.</p>}
        <div className="grid md:grid-cols-2 gap-3">
          {historyGraph('queuedLocal','Локальная очередь Android')}
          {historyGraph('failedSends','Счётчик неудачных отправок')}
          {historyGraph('retryPending','Ожидаемые повторы')}
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300">Всего heartbeat в выборке: {history.items.length}. С данными телеметрии: {telemetryPoints.length}. История начинается после установки миграции и не восстанавливает прошлые измерения.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        {[['Сообщения в базе за период', state.analytics?.totals?.messages ?? 'Нет данных'], ['Обработано анализатором', state.analytics?.totals?.analyzed ?? 'Нет данных'], ['Среднее время анализа', formatDuration(state.analytics?.totals?.averageAnalysisMs)]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 dark:border-white/15 p-3"><p className="text-xs text-slate-600 dark:text-slate-300">{label}</p><strong className="text-lg block mt-1">{value}</strong></div>)}
      </div>
      <details className="rounded-xl border border-slate-200 dark:border-white/15 p-3">
        <summary className="font-semibold cursor-pointer">Динамика полученных сообщений (записи сервера)</summary>
        <div className="flex items-end gap-1 h-32 mt-4" role="img" aria-label="Число сохранённых сообщений по дням">
          {daily.map(day => <div key={day.date} className="flex-1 min-w-0 bg-violet-500/80 dark:bg-violet-400/80 rounded-t" style={{ height: Math.max(2, (day.messages || 0) / scale * 100) + '%' }} title={day.date + ': ' + day.messages} />)}
        </div>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Отсутствие сообщений в день не доказывает отсутствие предупреждений или корректную доставку.</p>
      </details>
    </div>}
    {onOpen && <button type="button" onClick={() => onOpen('incidents')} className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-sm">Открыть журнал технических неисправностей</button>}
    <p className="text-xs text-slate-600 dark:text-slate-300">Данные Android VM — последний переданный снимок, а не исторический журнал телеметрии. Задержка последнего события основана на временных метках, которые могут различаться между устройствами. Полученные сообщения нельзя считать доказательством полноты push-доставки. Автозапуск вещания отключён. Обновлено: {formatDate(state.updated)}.</p>
  </section>;
}
