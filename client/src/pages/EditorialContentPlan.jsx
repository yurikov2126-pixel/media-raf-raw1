import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const platforms = { VK: 'ВКонтакте', TELEGRAM: 'Telegram', WEBSITE: 'Сайт', OTHER: 'Другая площадка' };
const statuses = { IDEA: 'Идея', IN_PROGRESS: 'В работе', REVIEW: 'На проверке', READY: 'Готово', PUBLISHED: 'Опубликовано' };
const blank = date => ({ title: '', description: '', platform: 'VK', status: 'IDEA', publishAt: `${date}T12:00`, assigneeId: '' });
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const localValue = value => { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

export default function EditorialContentPlan() {
    const { token } = useAuth();
    const [month, setMonth] = useState(() => new Date());
    const [selected, setSelected] = useState(() => dateKey(new Date()));
    const [items, setItems] = useState([]);
    const [canEdit, setCanEdit] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [platformFilter, setPlatformFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [refresh, setRefresh] = useState(0);
    const from = new Date(month.getFullYear(), month.getMonth(), 1);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    useEffect(() => {
        let active = true;
        setError('');
        api(`/editorial/content-plan?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`, { token })
            .then(result => { if (active) { setItems(result.items || []); setCanEdit(!!result.canEdit); } })
            .catch(err => { if (active) setError(err.message || 'Не удалось загрузить контент-план'); });
        return () => { active = false; };
    }, [token, month.getFullYear(), month.getMonth(), refresh]);
    const byDay = useMemo(() => {
        const map = new Map();
        for (const item of items) {
            if (platformFilter !== "ALL" && item.platform !== platformFilter) continue;
            if (statusFilter !== "ALL" && item.status !== statusFilter) continue;
            const key = dateKey(new Date(item.publishAt));
            map.set(key, [...(map.get(key) || []), item]);
        }
        return map;
    }, [items, platformFilter, statusFilter]);
    const firstWeekday = (from.getDay() + 6) % 7;
    const cells = Array.from({ length: Math.ceil((firstWeekday + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7 }, (_, i) =>
        new Date(month.getFullYear(), month.getMonth(), i - firstWeekday + 1));
    const open = item => {
        setEditing(item || null);
        setForm(item ? { ...item, publishAt: localValue(item.publishAt), assigneeId: item.assigneeId || '' } : blank(selected));
        setError('');
    };
    const save = async e => {
        e.preventDefault();
        setBusy(true); setError('');
        try {
            await api(editing ? `/editorial/content-plan/${editing.id}` : '/editorial/content-plan', {
                token, method: editing ? 'PATCH' : 'POST',
                body: { ...form, assigneeId: form.assigneeId || null, publishAt: new Date(form.publishAt).toISOString() },
            });
            setForm(null); setRefresh(v => v + 1);
        } catch (err) { setError(err.message || 'Не удалось сохранить публикацию'); }
        finally { setBusy(false); }
    };
    const remove = async () => {
        if (!editing || !window.confirm('Удалить публикацию из плана?')) return;
        setBusy(true);
        try {
            await api(`/editorial/content-plan/${editing.id}`, { token, method: 'DELETE' });
            setForm(null); setRefresh(v => v + 1);
        } catch (err) { setError(err.message || 'Не удалось удалить публикацию'); }
        finally { setBusy(false); }
    };
    return <section className="editorial-content-plan editorial-workspace-content space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">Контент-план редакции</h2><p className="text-sm opacity-70">Общий график публикаций команды</p></div>
            <div className="flex items-center gap-2">
                <button className="rounded-xl border px-4 py-2" onClick={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} aria-label="Предыдущий месяц">‹</button>
                <strong className="min-w-32 text-center capitalize">{month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</strong>
                <button className="rounded-xl border px-4 py-2" onClick={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} aria-label="Следующий месяц">›</button>
            </div>
        </div>
        <div className="editorial-content-plan-filters flex flex-wrap gap-3 rounded-2xl border p-3"><label className="text-sm">Площадка<select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border p-2"><option value="ALL">Все площадки</option>{Object.entries(platforms).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-sm">Статус<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border p-2"><option value="ALL">Все статусы</option>{Object.entries(statuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
        <div className="editorial-content-plan-calendar grid grid-cols-7 gap-1 sm:gap-2">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day => <span key={day} className="text-center text-xs font-semibold opacity-65">{day}</span>)}
            {cells.map(d => { const key = dateKey(d); const count = (byDay.get(key) || []).length; return <button key={key} onClick={() => setSelected(key)} type="button" aria-pressed={selected === key} className={`min-h-14 rounded-xl border p-1 text-left sm:min-h-20 sm:p-2 ${selected === key ? 'border-violet-500 bg-violet-100 dark:bg-violet-900/40' : 'border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-800/50'} ${d.getMonth() !== month.getMonth() ? 'opacity-40' : ''}`}><span className="text-xs font-semibold">{d.getDate()}</span>{count > 0 && <span className="mt-1 block rounded-md bg-violet-600 px-1 py-0.5 text-center text-xs text-white">{count}</span>}</button>; })}
        </div>
        <div className="editorial-content-plan-day-list rounded-2xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Публикации на {new Date(selected + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</h3>{canEdit && <button onClick={() => open(null)} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white">＋ Запланировать</button>}</div>
            <div className="mt-3 space-y-2">{(byDay.get(selected) || []).length ? (byDay.get(selected) || []).map(item => <button key={item.id} type="button" onClick={() => canEdit && open(item)} className="editorial-content-plan-item flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-left" disabled={!canEdit}><span><strong className="block">{item.title}</strong><span className="text-xs opacity-70">{platforms[item.platform]} · {statuses[item.status]}</span></span><span className="text-sm">{new Date(item.publishAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span></button>) : <p className="text-sm opacity-65">На эту дату публикаций пока нет.</p>}</div>
        </div>
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
        {form && <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/70 sm:items-center sm:p-4"><section role="dialog" aria-modal="true" aria-label="Публикация" className="editorial-content-plan-dialog max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 shadow-xl sm:rounded-3xl"><div className="flex justify-between"><h3 className="text-lg font-bold">{editing ? 'Редактировать публикацию' : 'Новая публикация'}</h3><button onClick={() => { setForm(null); setError(''); }} aria-label="Закрыть">✕</button></div>
            <form onSubmit={save} className="mt-4 space-y-3">
                <label className="block text-sm">Название<input required maxLength={160} className="mt-1 w-full rounded-xl border bg-transparent p-3" value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} /></label>
                <label className="block text-sm">Дата и время выхода<input required type="datetime-local" className="mt-1 w-full rounded-xl border bg-transparent p-3" value={form.publishAt} onChange={e => setForm(v => ({ ...v, publishAt: e.target.value }))} /></label>
                <label className="block text-sm">Площадка<select className="mt-1 w-full rounded-xl border bg-transparent p-3" value={form.platform} onChange={e => setForm(v => ({ ...v, platform: e.target.value }))}>{Object.entries(platforms).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="block text-sm">Статус<select className="mt-1 w-full rounded-xl border bg-transparent p-3" value={form.status} onChange={e => setForm(v => ({ ...v, status: e.target.value }))}>{Object.entries(statuses).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="block text-sm">Описание<textarea maxLength={2000} rows={3} className="mt-1 w-full rounded-xl border bg-transparent p-3" value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} /></label>
                {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
                <div className="flex gap-2"><button disabled={busy} className="min-h-11 flex-1 rounded-xl bg-violet-600 px-4 font-semibold text-white">{busy ? 'Сохраняем…' : 'Сохранить'}</button>{editing && <button disabled={busy} type="button" onClick={remove} className="rounded-xl border border-rose-300 px-4 text-rose-600">Удалить</button>}</div>
            </form></section></div>}
    </section>;
}
