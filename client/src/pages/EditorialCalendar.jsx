import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const STATUS = { TODO: 'К выполнению', IN_PROGRESS: 'В работе', IN_REVIEW: 'Ожидает проверки', REVISION: 'На доработке', APPROVED: 'Утверждено', DONE: 'Завершено' };
const done = status => ['DONE', 'APPROVED'].includes(status);
const dateOf = value => { if (!value) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; };
const keyOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfWeek = d => { const result = new Date(d.getFullYear(), d.getMonth(), d.getDate()); result.setDate(result.getDate() - ((result.getDay() + 6) % 7)); return result; };
const shift = (d, n) => { const next = new Date(d.getFullYear(), d.getMonth(), d.getDate()); next.setDate(next.getDate() + n); return next; };
const dateLabel = d => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const timeLabel = d => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const taskLink = t => `/app/editorial/projects?project=${encodeURIComponent(t.projectId)}&task=${encodeURIComponent(t.id)}&tab=details&from=my-tasks`;
const isOverdue = (task, now) => !done(task.status) && dateOf(task.dueAt)?.getTime() < now;
const tone = (task, now) => isOverdue(task, now) ? 'overdue' : done(task.status) ? 'done' : task.status === 'REVISION' ? 'revision' : task.status === 'IN_REVIEW' ? 'review' : 'active';

function TaskRow({ task, now }) {
    const due = dateOf(task.dueAt);
    return <Link to={taskLink(task)} className="editorial-planner-task group flex min-w-0 items-center gap-3 rounded-2xl border p-3 sm:p-4" data-tone={tone(task, now)}>
        <span className="editorial-planner-task-marker shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
            <strong className="block break-words text-sm font-semibold">{task.title}</strong>
            <span className="mt-1 block truncate text-xs opacity-75">{task.project?.title || 'Редакционное задание'} · {STATUS[task.status] || task.status}</span>
        </span>
        <span className="shrink-0 text-right text-xs font-semibold"><span className="block">{due ? timeLabel(due) : '—'}</span><span className="mt-1 block opacity-60" aria-hidden="true">Открыть ↗</span></span>
    </Link>;
}


const localInput = date => {
    const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
};
function PersonalEventForm({ event, date, token, onSaved, onCancel }) {
    const start = event ? new Date(event.startsAt) : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10);
    const finish = event ? new Date(event.endsAt) : new Date(start.getTime() + 3600000);
    const [title, setTitle] = useState(event?.title || '');
    const [description, setDescription] = useState(event?.description || '');
    const [startsAt, setStartsAt] = useState(localInput(start));
    const [endsAt, setEndsAt] = useState(localInput(finish));
    const [allDay, setAllDay] = useState(event?.allDay || false);
    const [scope, setScope] = useState('one');
    const [repeat, setRepeat] = useState('NONE');
    const [repeatUntil, setRepeatUntil] = useState(() => {
        const d = new Date(start);
        d.setMonth(d.getMonth() + 3);
        return localInput(d).slice(0, 10);
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submit = async e => {
        e.preventDefault();
        setError('');
        const startDate = new Date(startsAt);
        const endDate = new Date(endsAt);
        if (!title.trim() || !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
            setError('Проверьте название и время окончания'); return;
        }
        if ((!event || scope === 'series') && repeat !== 'NONE' && repeatUntil < startsAt.slice(0, 10)) {
            setError('Дата окончания повторения должна быть не раньше начала'); return;
        }
        setBusy(true);
        try {
            await api(event ? `/editorial/calendar/${event.id}` : '/editorial/calendar', {
                token, method: event ? 'PATCH' : 'POST',
                body: { title: title.trim(), description: description.trim(), startsAt: startDate.toISOString(), endsAt: endDate.toISOString(), allDay, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', scope: event?.seriesId && scope === 'series' ? 'series' : 'one', repeat: event?.seriesId && scope === 'one' ? 'NONE' : repeat, repeatUntil },
            });
            onSaved();
        } catch (err) { setError(err.message || 'Не удалось сохранить событие'); }
        finally { setBusy(false); }
    };
    const remove = async () => {
        if (!event || !window.confirm(scope === 'series' && event.seriesId ? 'Удалить всю серию повторений?' : 'Удалить это событие?')) return;
        setBusy(true); setError('');
        try { await api(`/editorial/calendar/${event.id}${scope === 'series' && event.seriesId ? '?scope=series' : ''}`, { token, method: 'DELETE' }); onSaved(); }
        catch (err) { setError(err.message || 'Не удалось удалить событие'); setBusy(false); }
    };
    return <div className="editorial-personal-event-overlay fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/65 p-0 sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="personal-event-heading" className="editorial-personal-event-dialog w-full max-w-lg rounded-t-3xl border p-5 shadow-2xl sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between gap-2"><h3 id="personal-event-heading" className="text-lg font-bold">{event ? 'Редактировать событие' : 'Новое личное событие'}</h3><button type="button" onClick={onCancel} aria-label="Закрыть" className="editorial-planner-control rounded-xl border px-3 py-2">✕</button></div>
            <form onSubmit={submit} className="space-y-3">
                <label className="block text-sm font-semibold">Название<input autoFocus required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} className="mt-1 block w-full rounded-xl border p-3" placeholder="Например, съёмка портрета" /></label>
                <label className="block text-sm font-semibold">Начало<input required type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} className="mt-1 block w-full rounded-xl border p-3" /></label>
                <label className="block text-sm font-semibold">Окончание<input required type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} className="mt-1 block w-full rounded-xl border p-3" /></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} /> Весь день (пометка)</label>
                {event?.seriesId && <fieldset className="rounded-xl border p-3"><legend className="px-1 text-sm font-semibold">Что изменить?</legend><label className="mr-4 inline-flex items-center gap-2 text-sm"><input type="radio" name="event-scope" checked={scope === 'one'} onChange={() => setScope('one')} /> Только это событие</label><label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="event-scope" checked={scope === 'series'} onChange={() => setScope('series')} /> Всю серию</label></fieldset>}
                {(!event || (event.seriesId && scope === 'series')) && <div className="space-y-3 rounded-xl border p-3">
                    <label className="block text-sm font-semibold">Повторение<select className="mt-1 block w-full rounded-xl border p-3" value={repeat} onChange={e => setRepeat(e.target.value)}>
                        <option value="NONE">Не повторять</option><option value="DAILY">Каждый день</option><option value="WEEKLY">Каждую неделю</option><option value="WEEKDAYS">По будням</option><option value="MONTHLY">Каждый месяц</option>
                    </select></label>
                    {repeat !== 'NONE' && <label className="block text-sm font-semibold">Повторять до<input type="date" required value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} className="mt-1 block w-full rounded-xl border p-3" /><span className="mt-1 block text-xs opacity-70">Не более года. Время повторений сохраняется по часовому поясу вашего устройства.</span></label>}
                </div>}
                <label className="block text-sm font-semibold">Заметки<textarea maxLength={2000} rows={3} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 block w-full rounded-xl border p-3" placeholder="Детали и планы" /></label>
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
                <div className="flex flex-wrap gap-2 pt-2"><button disabled={busy} type="submit" className="editorial-personal-event-primary min-h-11 flex-1 rounded-xl px-4 font-semibold">{busy ? 'Сохранение…' : 'Сохранить'}</button>{event && <button disabled={busy} type="button" onClick={remove} className="editorial-personal-event-delete min-h-11 rounded-xl border px-4">Удалить</button>}</div>
            </form>
        </section>
    </div>;
}

export default function EditorialCalendar() {
    const { token } = useAuth();
    const [view, setView] = useState('month');
    const [selected, setSelected] = useState(() => new Date());
    const [dateChosen, setDateChosen] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [events, setEvents] = useState([]);
    const [editing, setEditing] = useState(undefined);
    const [eventsError, setEventsError] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refresh, setRefresh] = useState(0);
    const now = Date.now();
    useEffect(() => {
        let active = true;
        setLoading(true); setError('');
        api('/editorial/workflow/my-tasks', { token })
            .then(data => { if (active) setTasks(data.tasks || []); })
            .catch(err => { if (active) { setError(err.message || 'Не удалось загрузить задания'); setTasks([]); } })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [token, refresh]);

    useEffect(() => {
        let active = true;
        setEventsError('');
        const from = new Date(selected.getFullYear(), selected.getMonth() - 2, 1).toISOString();
        const to = new Date(selected.getFullYear(), selected.getMonth() + 3, 1).toISOString();
        api(`/editorial/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { token })
            .then(data => { if (active) setEvents(data.events || []); })
            .catch(err => { if (active) { setEvents([]); setEventsError(err.message || 'Не удалось загрузить личные события'); } });
        return () => { active = false; };
    }, [token, selected.getFullYear(), selected.getMonth(), refresh]);
    const eventsByDate = useMemo(() => {
        const map = new Map();
        events.forEach(event => {
            const start = dateOf(event.startsAt);
            const end = dateOf(event.endsAt);
            if (!start || !end) return;
            for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()), i = 0; d < end && i < 32; d = shift(d, 1), i++) {
                const key = keyOf(d);
                map.set(key, [...(map.get(key) || []), event]);
            }
        });
        return map;
    }, [events]);
    const byDate = useMemo(() => {
        const map = new Map();
        tasks.forEach(task => {
            const date = dateOf(task.dueAt);
            if (!date) return;
            const key = keyOf(date);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(task);
        });
        map.forEach(rows => rows.sort((a, b) => dateOf(a.dueAt) - dateOf(b.dueAt)));
        return map;
    }, [tasks]);

    const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const first = startOfWeek(monthStart);
    const lastDay = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
    const end = shift(lastDay, 6 - ((lastDay.getDay() + 6) % 7));
    const daysInMonthGrid = Math.round((end - first) / 86400000) + 1;
    const monthDays = Array.from({ length: daysInMonthGrid }, (_, i) => shift(first, i));
    const weekStart = startOfWeek(selected);
    const weekDays = Array.from({ length: 7 }, (_, i) => shift(weekStart, i));
    const selectedKey = keyOf(selected);
    const selectedTasks = byDate.get(selectedKey) || [];
    const selectedEvents = eventsByDate.get(selectedKey) || [];
    const upcoming = useMemo(() => tasks.filter(t => {
        const due = dateOf(t.dueAt);
        return due && !done(t.status) && due.getTime() >= now && due.getTime() < now + 7 * 86400000;
    }).sort((a, b) => dateOf(a.dueAt) - dateOf(b.dueAt)).slice(0, 7), [tasks, now]);
    const monthCount = tasks.filter(t => { const d = dateOf(t.dueAt); return d && d.getFullYear() === selected.getFullYear() && d.getMonth() === selected.getMonth(); }).length;
    const navigate = delta => { setDateChosen(false); setSelected(previous => view === 'month'
        ? new Date(previous.getFullYear(), previous.getMonth() + delta, Math.min(previous.getDate(), new Date(previous.getFullYear(), previous.getMonth() + delta + 1, 0).getDate()))
        : shift(previous, delta * (view === 'week' ? 7 : 1))); };
    const title = view === 'month' ? selected.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
        : view === 'week' ? `${weekDays[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${weekDays[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : selected.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

    const renderDay = (d, outside = false) => {
        const key = keyOf(d);
        const rows = byDate.get(key) || [];
        const eventCount = (eventsByDate.get(key) || []).length;
        const overdue = rows.some(t => isOverdue(t, now));
        return <button key={key} type="button" onClick={() => { setSelected(d); setDateChosen(true); }}
            className="editorial-planner-day flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border p-1"
            data-selected={key === selectedKey} data-outside={outside} data-today={key === keyOf(new Date())}
            aria-pressed={key === selectedKey}
            aria-label={`${dateLabel(d)}, заданий: ${rows.length}, личных событий: ${eventCount}${overdue ? ', есть просроченные' : ''}`}>
            <span className="text-sm font-semibold">{d.getDate()}</span>
            {rows.length + eventCount > 0 && <span className="editorial-planner-day-count rounded-full px-1.5 text-[10px] font-bold">{rows.length + eventCount}</span>}
            {overdue && <span className="editorial-planner-overdue-dot" aria-hidden="true" />}
        </button>;
    };

    return <section className="editorial-calendar editorial-planner space-y-5" aria-label="Личный календарь">
        <header className="editorial-planner-heading flex flex-wrap items-center justify-between gap-3">
            <div><span className="editorial-planner-eyebrow text-xs font-bold uppercase tracking-widest">Личное пространство</span><h2 className="mt-1 text-2xl font-bold">Мой календарь</h2><p className="mt-1 text-sm opacity-75">Задания, сроки и планы на неделю — только для вас</p></div>
            <button type="button" className="editorial-planner-control min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold" onClick={() => setRefresh(v => v + 1)} disabled={loading}>{loading ? 'Загрузка…' : '↻ Обновить'}</button>
        </header>
        {error && <p role="alert" className="rounded-xl border border-rose-400 p-3 text-sm">{error}</p>}
        <div className="editorial-planner-layout grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
            <div className="space-y-4">
                <section className="editorial-planner-panel rounded-3xl border p-3 sm:p-5" aria-label="Календарная сетка">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="editorial-planner-segments inline-flex rounded-xl p-1" role="group" aria-label="Режим календаря">
                            {[['month','Месяц'],['week','Неделя'],['day','День']].map(([id,label]) => <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} className="min-h-10 rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm">{label}</button>)}
                        </div>
                        <button type="button" onClick={() => { setSelected(new Date()); setDateChosen(true); }} className="editorial-planner-control min-h-10 rounded-xl border px-3 text-sm font-semibold">Сегодня</button>
                    </div>
                    <div className="my-5 flex items-center justify-between gap-2">
                        <button type="button" className="editorial-planner-control flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xl" onClick={() => navigate(-1)} aria-label="Назад">‹</button>
                        <h3 className="text-center text-base font-bold capitalize sm:text-lg">{title}</h3>
                        <button type="button" className="editorial-planner-control flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xl" onClick={() => navigate(1)} aria-label="Вперёд">›</button>
                    </div>
                    {view !== 'day' && <div className="editorial-planner-grid grid grid-cols-7 gap-1 sm:gap-2">
                        {WEEKDAYS.map(w => <span key={w} className="py-2 text-center text-xs font-semibold opacity-60">{w}</span>)}
                        {(view === 'month' ? monthDays : weekDays).map(d => renderDay(d, view === 'month' && d.getMonth() !== selected.getMonth()))}
                    </div>}
                    {view === 'day' && <div className="editorial-planner-day-focus rounded-2xl p-5 text-center">
                        <span className="text-xs font-semibold uppercase tracking-widest opacity-70">{selected.toLocaleDateString('ru-RU', { weekday: 'long' })}</span>
                        <strong className="mt-2 block text-5xl font-bold">{selected.getDate()}</strong>
                        <span className="mt-2 block text-sm opacity-75">{selectedTasks.length} заданий со сроком</span>
                    </div>}
                    <div className="editorial-planner-legend mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t pt-4 text-xs">
                        <span><i data-tone="active" />В работе</span><span><i data-tone="review" />На проверке</span><span><i data-tone="revision" />Доработка</span><span><i data-tone="overdue" />Просрочено</span>
                    </div>
                </section>
                <section className="editorial-planner-panel rounded-3xl border p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">На {dateLabel(selected)}</h3><span className="text-xs opacity-70">{selectedTasks.length} заданий · {selectedEvents.length} событий</span></div>
                    {dateChosen && <button type="button" onClick={() => setEditing(null)} className="editorial-personal-event-primary mt-4 min-h-11 w-full rounded-xl px-5 font-semibold sm:w-auto">＋ Создать личное событие на {dateLabel(selected)}</button>}
                    {selectedEvents.length > 0 && <div className="mt-4 space-y-2">{selectedEvents.map(event => <button type="button" key={event.id} onClick={() => setEditing(event)} className="editorial-personal-event-row w-full rounded-xl border p-3 text-left"><strong className="block text-sm">{event.title}</strong><span className="text-xs opacity-75">{event.allDay ? 'Весь день' : timeLabel(dateOf(event.startsAt))} · {event.seriesId ? '↻ Повторяющееся событие' : 'Личное событие'}</span></button>)}</div>}
                    {loading ? <p role="status" className="mt-4 text-sm opacity-70">Загружаем задания…</p>
                        : selectedTasks.length ? <div className="mt-4 space-y-2">{selectedTasks.map(t => <TaskRow key={t.id} task={t} now={now} />)}</div>
                        : selectedEvents.length ? null : <p className="editorial-planner-empty mt-4 rounded-2xl p-5 text-sm">На этот день нет заданий и событий.</p>}
                </section>
            </div>
            <aside className="space-y-4">
                <section className="editorial-planner-panel rounded-3xl border p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2"><h3 className="font-bold">Ближайшие 7 дней</h3><span className="editorial-planner-mini-count rounded-full px-2 py-1 text-xs font-bold">{upcoming.length}</span></div>
                    {loading ? <p role="status" className="mt-4 text-sm opacity-70">Загрузка…</p>
                        : upcoming.length ? <div className="mt-4 space-y-2">{upcoming.map(t => <div key={t.id}><p className="mb-1 text-xs font-semibold opacity-65">{dateLabel(dateOf(t.dueAt))}</p><TaskRow task={t} now={now} /></div>)}</div>
                        : <p className="editorial-planner-empty mt-4 rounded-2xl p-4 text-sm">На ближайшую неделю нет запланированных сроков.</p>}
                </section>
                <section className="editorial-planner-tip rounded-3xl border p-4 sm:p-5">
                    <span className="text-xl" aria-hidden="true">✦</span><h3 className="mt-2 font-bold">Всё под рукой</h3><p className="mt-2 text-sm opacity-80">Выберите дату, чтобы увидеть задания. Нажмите на карточку — откроется её подробная информация.</p>
                    <Link to="/app/editorial/my-tasks" className="mt-4 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">Все мои задания ↗</Link>
                </section>
            </aside>
        </div>
        <p className="text-xs opacity-60">Редакционные задания отображаются автоматически. Личные события доступны только вам.</p>
        {editing !== undefined && <PersonalEventForm key={editing?.id || 'new'} event={editing} date={selected} token={token} onCancel={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setRefresh(v => v + 1); }} />}
    </section>;
}
