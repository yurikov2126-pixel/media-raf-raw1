import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import MchsEventJournal from '../../../components/MchsEventJournal.jsx';
import MchsEventTypeRules from './MchsEventTypeRules.jsx';
import MchsDispatchPreview from './MchsDispatchPreview.jsx';
import MchsOperatorReviews from './MchsOperatorReviews.jsx';
import MchsQueueMonitor from './MchsQueueMonitor.jsx';
import MchsOperationalOverview from './MchsOperationalOverview.jsx';
import { api } from '../../../api/client.js';
import { useTheme } from '../../../store/theme.jsx';
import './mchsWorkspace.css';

export default function SafetyMchs({ token }) {
  const { resolved } = useTheme();
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [rulesView, setRulesView] = useState('templates');
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => { if (searchParams.get('mchsView') === 'rules' && searchParams.has('mchsEvent')) setRulesView('review'); }, [searchParams]);

  const panes = [
    ['overview', 'Обзор'],
    ['delivery', 'Android и доставка'],
    ['queue', 'Очередь и анализ'],
    ['incidents', 'Неисправности'],
    ['events', 'Уведомления'],
    ['rules', 'Правила и сценарии'],
    ['settings', 'Настройки'],
  ];
  const selectedEvent = searchParams.get('mchsEvent');
  const selectedPane = searchParams.get('mchsView');
  const pane = searchParams.has('incident') ? 'incidents' : panes.some(([id]) => id === selectedPane) ? selectedPane : 'overview';
  const switchPane = (next,incidentId) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'safety-mchs');
    params.set('mchsView', next);
    if(incidentId)params.set('incident',incidentId);
    else params.delete('incident');
    if (next !== 'events' && next !== 'rules') params.delete('mchsEvent');
    setSearchParams(params, { replace: true });
  };
  const openOperationalItem = (view, id) => {
    if (view === 'review') {
      setRulesView('review');
      const params = new URLSearchParams(searchParams);
      params.set('tab', 'safety-mchs');
      params.set('mchsView', 'rules');
      params.delete('incident');
      if (id) params.set('mchsEvent', id);
      else params.delete('mchsEvent');
      setSearchParams(params, { replace: true });
    } else {
      switchPane(view, id);
    }
  };
  const load = () => api('/safety/dashboard', { token }).then((result) => {
    setData(result); setDraft(result.config); setError('');
  }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [token]);
  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await api('/safety/config', { method: 'PUT', token, body: draft });
      setDraft(result.config); setNotice('Тестовые настройки сохранены. Оповещение не активировано.');
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  return <div data-mchs-theme={resolved} className="mchs-admin-workspace space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-500 dark:text-white/60">МЧС России · Политех-FM · этап 1: подготовка, без автоматического запуска</p>
      <button type="button" onClick={load} className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/10">Обновить состояние</button>
    </div>
    <div role="status" className="mchs-safety-banner rounded-2xl border border-amber-400/40 bg-amber-100/60 text-amber-950 dark:bg-amber-400/10 dark:text-amber-100 p-4">
      <strong>Тестовый режим. Реальное оповещение заблокировано.</strong>
      <p className="text-sm mt-1">Уведомления из Android сохраняются в журнале для наблюдения. Heartbeat не гарантирует получение всех push; отсутствующие записи не доказывают отсутствие предупреждений.</p>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-500/10 text-red-600 dark:text-red-300 p-3">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-500/10 p-3">{notice}</p>}
    <nav aria-label="Разделы управления МЧС" className="mchs-section-tabs flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
      {panes.map(([id,label]) => <button key={id} type="button" onClick={() => switchPane(id)}
        aria-current={pane === id ? 'page' : undefined}
        className={`shrink-0 snap-start rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${pane === id ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-200 dark:border-white/20 bg-white/70 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10'}`}>{label}</button>)}
    </nav>
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-xl font-semibold">{panes.find(([id])=>id===pane)?.[1]}</h2>
      <span className="text-xs text-slate-500 dark:text-white/50">Диагностика · без запуска эфира</span>
    </div>
    {pane === "settings" && <section className="mchs-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 sm:p-5 space-y-4">
      <h3 className="text-lg font-semibold">Параметры будущей интеграции</h3>
      {!draft ? <p>Загрузка…</p> : <>
        <label className="block text-sm">Регион
          <input className="mt-1 w-full rounded-xl border border-slate-300 dark:border-white/20 bg-transparent p-3" value={draft.region} maxLength={120} onChange={e => setDraft({ ...draft, region: e.target.value })} />
        </label>
        <p className="text-sm text-slate-500 dark:text-white/60">Планируемые направления (пока не активируются):</p>
        <div className="flex flex-wrap gap-5 text-sm">
          {[['radio', 'Онлайн-радио'], ['speakers', 'Громкоговорители колледжа']].map(([key, label]) =>
            <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={draft.destinations[key]} onChange={e => setDraft({ ...draft, destinations: { ...draft.destinations, [key]: e.target.checked } })}/>{label}</label>)}
        </div>
        <label className="block text-sm">Примечание
          <textarea rows={3} maxLength={500} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-white/20 bg-transparent p-3" value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
        </label>
        <button type="button" disabled={saving} onClick={save} className="rounded-xl bg-violet-600 px-5 py-2.5 text-white font-semibold disabled:opacity-50">{saving ? 'Сохранение…' : 'Сохранить настройки'}</button>
      </>}
    </section>}
    {pane === 'overview' && <MchsOperationalOverview token={token} onOpen={openOperationalItem} />}
    {(pane === 'delivery' || pane === 'queue' || pane === 'incidents') && <MchsQueueMonitor token={token} view={pane} />}

    {pane === "events" && <MchsEventJournal token={token} events={data?.events || []} total={data?.eventCount || 0} onReview={eventId => { setRulesView("review"); const params=new URLSearchParams(searchParams); params.set("tab","safety-mchs");params.set("mchsView","rules");params.set("mchsEvent",eventId);params.delete("incident");setSearchParams(params); }} />}
    {pane === "rules" && data && <div className="space-y-4">
      <nav aria-label="Разделы правил МЧС" className="mchs-subtabs flex flex-wrap gap-2">
        {[
          ['templates','Шаблоны сообщений'],
          ['preview','Проверка решений'],
          ['review','Очередь проверки']
        ].map(([id,label])=><button key={id} type="button" aria-pressed={rulesView===id} onClick={()=>setRulesView(id)}
          className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${rulesView===id?'bg-violet-600 border-violet-600 text-white':'border-slate-300 dark:border-white/20 hover:bg-slate-100 dark:hover:bg-white/10'}`}>{label}</button>)}
      </nav>
      <p className="text-sm text-slate-500 dark:text-white/60">Это инструменты диагностики. Шаблоны и ручные решения не подтверждают официальную тревогу и не разрешают эфир.</p>
      {rulesView==='templates' && <MchsEventTypeRules token={token} />}
      {rulesView==='preview' && <MchsDispatchPreview token={token} />}
      {rulesView==='review' && <MchsOperatorReviews token={token} events={data.events || []} selectedEvent={selectedEvent} onOpenEvent={eventId => { const params=new URLSearchParams(searchParams);params.set("mchsView","events");params.set("mchsEvent",eventId);setSearchParams(params); }} />}
    </div>}
    {pane === "settings" && <details className="rounded-2xl border border-sky-400/40 p-4 sm:p-5 space-y-3">
        <summary className="cursor-pointer font-semibold">Диагностические события — только TEST ONLY</summary>
        <p className="text-sm opacity-70">Изолированный журнал. Приём: {data?.diagnosticIngestEnabled ? 'включён' : 'выключен'}. Записей: {data?.diagnosticCount ?? 0}. Эти записи не являются предупреждениями МЧС и не запускают радио.</p>
        {data?.diagnosticEvents?.map(item => <div key={item.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-3 text-sm">
          <strong>ТЕСТ: диагностика приёмника</strong>
          <p className="opacity-70 break-all">{item.eventId} · {new Date(item.receivedAt).toLocaleString('ru-RU')}</p>
        </div>)}
      </details>}
    <Link to="/app/safety" className="text-violet-600 dark:text-violet-300 underline">Открыть пульт ответственного за безопасность</Link>
  </div>;
}
