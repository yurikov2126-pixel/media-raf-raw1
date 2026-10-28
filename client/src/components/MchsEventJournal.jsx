import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';

const ageOf = (event) => event.occurredAt ? Date.now() - new Date(event.occurredAt).getTime() : null;
const historical = (event) => { const age = ageOf(event); return age === null || !Number.isFinite(age) || age > 30 * 60 * 1000 || age < -120000; };
const dateText = (value) => value ? new Date(value).toLocaleString('ru-RU') : 'Не указано';

export default function MchsEventJournal({ events = [], total = 0, token, onReview }) {
  const [query, setQuery] = useState('');
  const [ageFilter, setAgeFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [trace, setTrace] = useState(null);
  const [traceError, setTraceError] = useState('');
  useEffect(() => {
    if (!selected?.id || !token) return;
    let active = true;
    setTrace(null); setTraceError('');
    api('/safety/message-history/' + encodeURIComponent(selected.id), { token })
      .then(value => { if(active)setTrace(value); })
      .catch(error => { if(active)setTraceError(error.message || 'Не удалось получить историю'); });
    return () => { active = false; };
  }, [selected?.id, token]);
  const closeRef = useRef(null);
  const openerRef = useRef(null);
  useEffect(() => {
    if (!selected) return;
    closeRef.current?.focus();
    const onKey = e => { if (e.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown',onKey); document.body.style.overflow=previous; openerRef.current?.focus(); };
  }, [selected]);
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
        <button type="button" onClick={event => { openerRef.current=event.currentTarget; setSelected(e); }} className="mt-3 rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/10">Открыть сообщение</button>
      </article>)}</div>}
    {selected && <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" aria-hidden="true" />
      <section role="dialog" aria-modal="true" aria-labelledby="mchs-message-detail-title"
        className="relative w-full max-w-2xl max-h-[88dvh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 shadow-2xl p-4 sm:p-6 space-y-4 text-slate-900 dark:text-white">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs text-slate-600 dark:text-slate-300">Журнал сообщений МЧС · диагностическое наблюдение</p><h3 id="mchs-message-detail-title" className="font-semibold text-lg mt-1 break-words">{selected.title || 'Без заголовка'}</h3></div>
          <button ref={closeRef} type="button" onClick={()=>setSelected(null)} className="shrink-0 rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2 text-sm">Закрыть</button>
        </div>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-400/10 p-3 text-sm text-amber-950 dark:text-amber-100">Сообщение получено через диагностический канал. Официальное происхождение и актуальность угрозы независимо не подтверждены. Радиоэфир не запускается.</div>
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed rounded-xl border border-slate-200 dark:border-white/15 p-4">{selected.body || 'Текст отсутствует'}</div>
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          {[
            ['Время в Android',dateText(selected.occurredAt)],['Получено сервером',dateText(selected.receivedAt)],
            ['Регион',selected.region||'Не установлен'],['Канал',selected.channelId||'Не указан'],
            ['Источник',selected.source||'Неизвестен'],['Тип сообщения',selected.eventType||'Не классифицировано'],
            ['Отметка проверки',selected.verified?'Имеется отметка (не подтверждает подлинность)':'Не подтверждено независимо'],
            ['Состояние по времени',historical(selected)?'Историческая или неизвестная дата':'Недавнее наблюдение']
          ].map(([label,value])=><div key={label} className="min-w-0 rounded-lg bg-slate-50 dark:bg-white/5 p-3"><dt className="text-xs text-slate-600 dark:text-slate-300">{label}</dt><dd className="mt-1 font-medium break-words">{value}</dd></div>)}
        </dl>
        {onReview && <button type="button" onClick={() => { const id=selected.id; setSelected(null); onReview(id); }} className="rounded-xl bg-violet-600 px-4 py-2.5 text-white text-sm font-semibold">Перейти к ручной проверке</button>}
        <section aria-label="История обработки" className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-3">
          <h4 className="font-semibold">История обработки сообщения</h4>
          {!trace && !traceError && <p className="text-sm">Загрузка диагностической истории…</p>}
          {traceError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{traceError}</p>}
          {trace && <>
            {!trace.queues?.length && <p className="text-sm">Для сообщения пока нет записей очереди анализа.</p>}
            {(trace.queues || []).map(queue => <div key={queue.id} className="space-y-2">
              <p className="text-sm font-medium">Очередь: {queue.status} · попыток: {queue.attempts}</p>
              {queue.lastError && <p className="text-sm">Последняя техническая ошибка: {queue.lastError}</p>}
              {(queue.history || []).length ? <ol className="border-l-2 border-violet-300 dark:border-violet-600 pl-4 space-y-2">
                {queue.history.map(item => <li key={item.id} className="text-sm"><strong>{item.status}</strong> · {item.reason}<span className="block text-xs text-slate-600 dark:text-slate-300">{dateText(item.createdAt)}</span></li>)}
              </ol> : <p className="text-sm">Этапы анализа не зарегистрированы.</p>}
            </div>)}
            <div className="border-t border-slate-200 dark:border-white/15 pt-3">
              <h4 className="font-semibold">Решение ответственного</h4>
              {trace.review ? <div className="text-sm mt-2 space-y-1">
                <p>Решение: {trace.review.decision === 'ACKNOWLEDGED' ? 'Ознакомлен' : trace.review.decision === 'DISMISSED' ? 'Отклонено' : trace.review.decision}</p>
                <p>Комментарий: {trace.review.note || 'Не указан'}</p>
                <p>Время: {dateText(trace.review.reviewedAt)}</p>
                <p className="text-xs">ID ответственного: {trace.review.reviewedBy || 'Не указан'}</p>
              </div> : <p className="text-sm mt-2">Решение оператора не зарегистрировано.</p>}
            </div>
          </>}
        </section>
        <div className="text-xs text-slate-600 dark:text-slate-300 break-all">ID: {selected.id}</div>
        <p className="text-xs text-slate-600 dark:text-slate-300">История показывает только сохранённые диагностические действия и не подтверждает официальную тревогу или разрешение на эфир.</p>
      </section>
    </div>}
    {pageCount > 1 && <div className="flex items-center justify-between gap-3 text-sm">
      <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40 dark:border-white/20" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Назад</button>
      <span>Страница {Math.min(page, pageCount)} из {pageCount}</span>
      <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40 dark:border-white/20" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>Вперёд</button>
    </div>}
  </section>;
}
