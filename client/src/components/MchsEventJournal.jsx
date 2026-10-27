import { useMemo, useState } from 'react';

const ageOf = (event) => event.occurredAt ? Date.now() - new Date(event.occurredAt).getTime() : null;
const historical = (event) => { const age = ageOf(event); return age === null || !Number.isFinite(age) || age > 30 * 60 * 1000 || age < -120000; };
const dateText = (value) => value ? new Date(value).toLocaleString('ru-RU') : 'Не указано';

export default function MchsEventJournal({ events = [], total = 0 }) {
  const [query, setQuery] = useState('');
  const [ageFilter, setAgeFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const visible = useMemo(() => events.filter(e => {
    if (ageFilter === 'historical' && !historical(e)) return false;
    if (ageFilter === 'recent' && historical(e)) return false;
    return [e.title, e.body, e.region, e.channelId].some(v => String(v || '').toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU')));
  }), [events, query, ageFilter]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageItems = visible.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);

  return <section className="rounded-2xl border border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/5 p-4 md:p-5 space-y-4">
    <div>
      <h2 className="text-lg font-semibold">Журнал сообщений МЧС</h2>
      <p className="text-sm opacity-65 mt-1">Всего в базе: {total}. Ни одно наблюдение само по себе не подтверждает текущую опасность или официальное происхождение предупреждения.</p>
    </div>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(180px,auto)]">
      <input aria-label="Поиск по журналу МЧС" placeholder="Поиск по тексту, региону или каналу" className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-white/20" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/>
      <select aria-label="Фильтр по давности уведомления" className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-white/20" value={ageFilter} onChange={e => { setAgeFilter(e.target.value); setPage(1); }}>
        <option value="all">Все наблюдения</option>
        <option value="historical">Исторические (старше 30 мин)</option>
        <option value="recent">Недавние (до 30 мин)</option>
      </select>
    </div>
    <p className="text-xs opacity-60">Показано {visible.length} из {events.length} последних загруженных записей. Поиск и фильтр работают по загруженным записям, не по всей базе.</p>
    {pageItems.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm opacity-70 dark:border-white/20">Записей по выбранным условиям нет. Это не означает отсутствия предупреждений МЧС.</p> :
      <div className="space-y-2">{pageItems.map(e => <article key={e.id} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700 dark:bg-white/10 dark:text-white/80">{historical(e) ? 'Историческая запись' : 'Недавнее наблюдение'}</span>
          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">{e.verified ? 'Отметка проверки' : 'Не подтверждено независимо'}</span>
        </div>
        <h3 className="font-semibold mt-2 break-words">{e.title}</h3>
        <p className="text-sm mt-1 whitespace-pre-wrap break-words">{e.body}</p>
        <div className="mt-2 text-xs opacity-65">Время Android: {dateText(e.occurredAt)} · Запись на сервере: {dateText(e.receivedAt)}</div>
        <div className="mt-1 text-xs opacity-65">Регион: {e.region || 'не установлен'} · Канал: {e.channelId || 'не указан'}</div>
        <button type="button" onClick={() => setSelected(selected === e.id ? null : e.id)} className="mt-2 text-sm underline underline-offset-2">{selected === e.id ? 'Скрыть сведения' : 'Подробнее'}</button>
        {selected === e.id && <div className="mt-2 rounded-lg bg-slate-100 p-3 text-xs dark:bg-white/10 space-y-1">
          <p>Идентификатор записи: <span className="break-all">{e.id}</span></p>
          <p>Источник: {e.source || 'неизвестен'}</p>
          <p>Тип: {e.eventType || 'Не классифицировано'}</p>
          <p>Это наблюдение, а не разрешение на трансляцию предупреждения.</p>
        </div>}
      </article>)}</div>}
    {pageCount > 1 && <div className="flex items-center justify-between gap-3 text-sm">
      <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40 dark:border-white/20" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Назад</button>
      <span>Страница {Math.min(page, pageCount)} из {pageCount}</span>
      <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40 dark:border-white/20" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>Вперёд</button>
    </div>}
  </section>;
}
