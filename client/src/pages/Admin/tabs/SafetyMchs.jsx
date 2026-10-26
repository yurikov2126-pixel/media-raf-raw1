import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client.js';

export default function SafetyMchs({ token }) {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [eventFilter, setEventFilter] = useState('all');
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
  return <div className="space-y-5 text-slate-800 dark:text-white">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-500 dark:text-white/60">МЧС России · Политех-FM · этап 1: подготовка, без автоматического запуска</p>
      <button type="button" onClick={load} className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/10">Обновить состояние</button>
    </div>
    <div role="status" className="rounded-2xl border border-amber-400/40 bg-amber-100/60 text-amber-950 dark:bg-amber-400/10 dark:text-amber-100 p-4">
      <strong>Тестовый режим. Реальное оповещение заблокировано.</strong>
      <p className="text-sm mt-1">Ручная доставка наблюдений уже проверена. Автоматическая доставка Android ещё не подтверждена; отсутствие новых записей не означает отсутствия предупреждений МЧС.</p>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-500/10 text-red-600 dark:text-red-300 p-3">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-500/10 p-3">{notice}</p>}
    <div className="grid gap-3 md:grid-cols-3">
      {[['Источник Android', data?.source?.connection === 'HEARTBEAT_RECENT' ? 'Heartbeat недавно получен' : data?.source?.connection === 'HEARTBEAT_STALE' ? 'Связь потеряна / устарела' : 'Нет данных о соединении'], ['Listener / Push', data?.source?.connection === 'HEARTBEAT_RECENT' ? `${data?.source?.listener || 'UNKNOWN'} / ${data?.source?.push || 'UNKNOWN'}` : 'Не подтверждены'], ['Радио и громкоговорители', 'Автозапуск отключён']].map(([name, value]) =>
        <div key={name} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4"><p className="text-xs text-slate-500 dark:text-white/50">{name}</p><p className="mt-2 font-semibold">{value}</p></div>)}
    </div>
    <p className="text-xs text-slate-500 dark:text-white/50">Последний heartbeat: {data?.source?.lastSeen ? new Date(data.source.lastSeen).toLocaleString('ru-RU') : 'не получен'}. Heartbeat не подтверждает доставку push.</p>
    <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 space-y-4">
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
    </section>
    <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5">
      <h3 className="font-semibold text-lg">Журнал сообщений МЧС</h3><p className="text-sm text-amber-700 dark:text-amber-300">Наблюдения из Android не доказывают подлинность официального предупреждения и не означают действующую угрозу. Автоматический радиоэфир отключён.</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-white/60">Событий в базе: {data?.eventCount ?? '—'}. Приёмник: {data?.integration?.receiverConfigured ? 'включён' : 'выключен'}. Ручной импорт: {data?.integration?.deliveryVerified ? 'есть подтверждённая запись' : 'не подтверждён'}. Фоновая доставка: не проверена. Пустой журнал не подтверждает отсутствия предупреждений.</p>
      <label className="mt-3 flex items-center gap-2 text-sm">Показать
        <select className="rounded-lg border border-slate-300 dark:border-white/20 bg-transparent p-2" value={eventFilter} onChange={e => setEventFilter(e.target.value)}>
          <option value="all">Все наблюдения</option>
          <option value="historical">Исторические (старше 30 минут)</option>
          <option value="recent">Полученные недавно (до 30 минут)</option>
        </select>
      </label>
      {data?.events?.length > 0 && <div className="mt-4 space-y-3">{data.events.filter(event => {
        const age = Date.now() - new Date(event.occurredAt || event.receivedAt).getTime();
        const historical = !Number.isFinite(age) || age > 30 * 60 * 1000 || age < -2 * 60 * 1000;
        return eventFilter === 'all' || (eventFilter === 'historical' ? historical : !historical);
      }).map(event => <article key={event.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
        <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500 dark:text-white/50"><time>Получено сервером: {new Date(event.receivedAt).toLocaleString('ru-RU')}</time><span>{event.verified ? 'Подтверждение зафиксировано' : 'Не подтверждено независимо'}</span><span>{(Date.now() - new Date(event.occurredAt || event.receivedAt).getTime() > 30 * 60 * 1000) ? 'Историческое' : 'Недавнее наблюдение (не означает активную тревогу)'}</span></div>
        <p className="mt-1 text-xs opacity-70">Время события Android: {event.occurredAt ? new Date(event.occurredAt).toLocaleString('ru-RU') : 'не указано'}</p>
        <h4 className="mt-2 font-semibold break-words">{event.title}</h4><p className="mt-1 text-sm whitespace-pre-wrap break-words">{event.body}</p>
        <p className="mt-2 text-xs opacity-60">Канал: {event.channelId || 'не указан'} · Регион: {event.region || 'не указан'}</p>
      </article>)}</div>}
    </section>
    <section className="rounded-2xl border border-sky-400/40 p-5 space-y-3">
        <h2 className="font-semibold">Диагностические события — только TEST ONLY</h2>
        <p className="text-sm opacity-70">Изолированный журнал. Приём: {data?.diagnosticIngestEnabled ? 'включён' : 'выключен'}. Записей: {data?.diagnosticCount ?? 0}. Эти записи не являются предупреждениями МЧС и не запускают радио.</p>
        {data?.diagnosticEvents?.map(item => <div key={item.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-3 text-sm">
          <strong>ТЕСТ: диагностика приёмника</strong>
          <p className="opacity-70 break-all">{item.eventId} · {new Date(item.receivedAt).toLocaleString('ru-RU')}</p>
        </div>)}
      </section>
    <Link to="/app/safety" className="text-violet-600 dark:text-violet-300 underline">Открыть пульт ответственного за безопасность</Link>
  </div>;
}
