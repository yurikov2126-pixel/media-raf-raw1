import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const day = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
function validDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}
export default function EditorialOverview() {
    const { token } = useAuth();
    const [personal, setPersonal] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [canReview, setCanReview] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [version, setVersion] = useState(0);
    const reload = useCallback(() => setVersion(v => v + 1), []);
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        Promise.allSettled([
            api('/editorial/workflow/my-tasks', { token }),
            api('/editorial/workflow/review-inbox', { token }),
            api('/editorial/workflow/navigation', { token }),
        ]).then(([mine, inbox, navigation]) => {
            if (!active) return;
            if (mine.status === 'fulfilled') setPersonal(mine.value.tasks || []);
            else { setPersonal([]); setError('Не удалось загрузить личные задания.'); }
            if (inbox.status === 'fulfilled') {
                setReviews(inbox.value.tasks || []);
                setCanReview(navigation.status === 'fulfilled' && !!navigation.value.canManageProjects);
            } else { setReviews([]); setCanReview(false); }
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [token, version]);
    const now = Date.now();
    const metrics = useMemo(() => {
        const active = personal.filter(t => !['DONE','APPROVED'].includes(t.status));
        return {
            active: active.length,
            overdue: active.filter(t => validDate(t.dueAt)?.getTime() < now).length,
            revision: personal.filter(t => t.status === 'REVISION').length,
            review: reviews.length,
        };
    }, [personal, reviews, now]);
    const upcoming = useMemo(() => personal.filter(t => !['DONE','APPROVED'].includes(t.status) && validDate(t.dueAt))
        .sort((a,b) => validDate(a.dueAt) - validDate(b.dueAt)).slice(0,5), [personal]);
    return <section className="editorial-overview space-y-5" aria-label="Обзор редакции">
        <header className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">Рабочий обзор</h2><p className="mt-1 text-sm opacity-75">Ваши задачи, сроки и редакторская очередь в одном месте</p></div>
            <button type="button" onClick={reload} disabled={loading} className="editorial-overview-refresh min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60">{loading ? 'Загружаем…' : 'Обновить'}</button>
        </header>
        {error && <p role="alert" className="rounded-xl border border-amber-400/50 p-3 text-sm">{error}</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy={loading}>
            {[
                ['Активные', metrics.active, '/app/editorial/my-tasks'],
                ['Просрочены', metrics.overdue, '/app/editorial/my-tasks'],
                ['На доработке', metrics.revision, '/app/editorial/my-tasks?status=REVISION'],
                ...(canReview ? [['Ждут проверки', metrics.review, '/app/editorial/reviews']] : []),
            ].map(([label, count, url]) => <Link key={label} to={url} className="editorial-overview-stat block min-w-0 rounded-2xl border p-4 transition-transform hover:-translate-y-0.5">
                <span className="block text-xs font-semibold opacity-75">{label}</span>
                <strong className="mt-3 block text-3xl font-bold tabular-nums">{loading ? '—' : count}</strong>
                <span className="mt-2 block text-xs opacity-75">Перейти →</span>
            </Link>)}
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
            <section className="editorial-overview-panel space-y-3 rounded-2xl border p-4 sm:p-5 lg:col-span-3">
                <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Ближайшие сроки</h3><Link className="text-sm font-semibold underline underline-offset-4" to="/app/editorial/my-tasks">Все задания</Link></div>
                {loading ? <p role="status" className="text-sm opacity-70">Загружаем задания…</p> : upcoming.length === 0 ? <p className="py-4 text-sm opacity-70">Срочных заданий пока нет.</p> :
                <div className="space-y-2">{upcoming.map(t => <Link key={t.id} to={`/app/editorial/projects?project=${encodeURIComponent(t.projectId)}&task=${encodeURIComponent(t.id)}&from=my-tasks`} className="editorial-overview-item flex min-w-0 items-center justify-between gap-3 rounded-xl border p-3">
                    <span className="min-w-0"><strong className="block truncate text-sm">{t.title}</strong><span className="block truncate text-xs opacity-70">{t.project?.title || 'Задание'}</span></span>
                    <span className="shrink-0 text-xs font-semibold">{day.format(validDate(t.dueAt))}</span>
                </Link>)}</div>}
            </section>
            <section className="editorial-overview-panel space-y-3 rounded-2xl border p-4 sm:p-5 lg:col-span-2">
                <h3 className="font-semibold">Быстрые действия</h3>
                <Link to="/app/editorial/my-tasks" className="editorial-overview-action block rounded-xl border p-3 text-sm font-semibold">Мои задания <span aria-hidden="true">↗</span></Link>
                {canReview && <Link to="/app/editorial/reviews" className="editorial-overview-action block rounded-xl border p-3 text-sm font-semibold">Очередь проверки <span aria-hidden="true">↗</span></Link>}
                <p className="text-xs opacity-70">Показатели относятся к вашим заданиям. Очередь проверки доступна при наличии соответствующих прав.</p>
            </section>
        </div>
    </section>;
}
