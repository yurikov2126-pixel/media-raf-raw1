import { useState } from 'react';

const ICONS = ['dashboard', 'feed', 'message', 'book', 'bell', 'trophy', 'users', 'settings', 'sparkles', 'calendar', 'folder', 'camera', 'search'];
const ROUTES = [
    ['/app', 'Главная', 'dashboard'], ['/app/feed', 'Лента', 'feed'], ['/app/chats', 'Чаты', 'message'],
    ['/app/editorial', 'Редакция', 'folder'], ['/app/courses', 'Обучение', 'book'], ['/app/wiki', 'Wiki', 'book'],
    ['/app/notifications', 'Уведомления', 'bell'], ['/app/profile', 'Профиль', 'users'],
    ['/app/gamification', 'Геймификация', 'trophy'], ['/app/admin', 'Админка', 'settings'],
];
const INITIAL = ROUTES.slice(0, 6).map(([to, label, icon]) => ({ to, label, icon, ...(to === '/app' ? { end: true } : {}) }));
const validPath = (path) => typeof path === 'string' && /^\/app(?:\/[a-z0-9/_-]*)?$/i.test(path);
export default function MenuEditor({ settings, update }) {
    const [search, setSearch] = useState('');
    const [showPreview, setShowPreview] = useState(true);
    const [confirmReset, setConfirmReset] = useState(false);
    const parsed = (() => { try { return JSON.parse(settings.nav_items || '[]'); } catch { return []; } })();
    const items = Array.isArray(parsed) ? parsed : [];
    const persist = next => update({ nav_items: JSON.stringify(next) });
    const updateItem = (idx, patch) => persist(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
    const addItem = (route) => {
        const [to, label, icon] = route || ['/app/new', 'Новый раздел', 'sparkles'];
        persist([...items, { to, label, icon }]);
    };
    const removeItem = idx => persist(items.filter((_, i) => i !== idx));
    const moveItem = (idx, dir) => {
        const arr = [...items]; const j = idx + dir;
        if (j < 0 || j >= arr.length) return;
        [arr[idx], arr[j]] = [arr[j], arr[idx]]; persist(arr);
    };
    const duplicatePaths = new Set(items.filter((item, index) => items.findIndex(other => other.to === item.to) !== index).map(item => item.to));
    const missing = ROUTES.filter(([to]) => !items.some(item => item.to === to) && (!search || to.includes(search.toLowerCase()) || ROUTES.find(r => r[0] === to)?.[1].toLowerCase().includes(search.toLowerCase())));
    return <div className="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="font-semibold">Навигация платформы</h3>
            <p className="text-sm text-white/50 mt-1">Редактируйте пункты бокового меню: названия, адреса, иконки и порядок. Изменения вступят в силу после «Сохранить всё».</p>
            <p className="text-xs text-amber-300/80 mt-2">Это меню основного приложения. Мобильная нижняя панель и меню «Ещё» могут иметь собственный фиксированный состав.</p>
        </section>
        <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Пункты меню ({items.length})</h3><button type="button" onClick={() => setShowPreview(v => !v)} className="btn-ghost !py-2 text-sm">{showPreview ? 'Скрыть предпросмотр' : 'Показать предпросмотр'}</button></div>
            {items.map((it, i) => {
                const error = !String(it.label || '').trim() ? 'Укажите название' : !validPath(it.to) ? 'Адрес должен начинаться с /app и не содержать пробелов' : duplicatePaths.has(it.to) ? 'Повторяющийся адрес' : '';
                return <div key={i} className="card p-4 space-y-3">
                    <div className="flex items-center gap-2"><span className="text-lg" aria-hidden="true">☷</span><strong className="flex-1 min-w-0 break-words">{it.label || 'Без названия'}</strong><button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} className="btn-ghost !px-3 !py-1.5 disabled:opacity-30" aria-label={`Поднять ${it.label || 'пункт'}`}>↑</button><button type="button" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="btn-ghost !px-3 !py-1.5 disabled:opacity-30" aria-label={`Опустить ${it.label || 'пункт'}`}>↓</button><button type="button" onClick={() => removeItem(i)} className="btn-ghost !px-3 !py-1.5 text-pink" aria-label={`Удалить ${it.label || 'пункт'}`}>Удалить</button></div>
                    <div className="grid gap-3 md:grid-cols-3">
                        <label className="space-y-1"><span className="text-xs text-white/50">Название</span><input className="input !py-2 text-sm" value={it.label || ''} onChange={e => updateItem(i, { label: e.target.value })}/></label>
                        <label className="space-y-1"><span className="text-xs text-white/50">Адрес</span><input className="input !py-2 text-sm font-mono" value={it.to || ''} onChange={e => updateItem(i, { to: e.target.value })} placeholder="/app/editorial"/></label>
                        <label className="space-y-1"><span className="text-xs text-white/50">Иконка</span><input className="input !py-2 text-sm" list="menu-icons" value={it.icon || ''} onChange={e => updateItem(i, { icon: e.target.value })} placeholder="folder"/></label>
                    </div>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!it.end} onChange={e => updateItem(i, { end: e.target.checked })}/>Только точное совпадение адреса</label>
                    {error && <p className="text-xs text-pink" role="alert">{error}</p>}
                </div>;
            })}
            <datalist id="menu-icons">{ICONS.map(icon => <option key={icon} value={icon}/>)}</datalist>
            <button type="button" onClick={() => addItem()} className="btn-ghost">＋ Добавить произвольный пункт</button>
        </section>
        <section className="rounded-2xl border border-white/10 p-4 space-y-3">
            <h3 className="font-semibold">Добавить существующий раздел</h3>
            <input className="input" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск раздела…" aria-label="Поиск раздела для добавления"/>
            <div className="flex flex-wrap gap-2">{missing.length ? missing.map(route => <button type="button" key={route[0]} onClick={() => addItem(route)} className="btn-ghost !py-2 text-sm">＋ {route[1]}</button>) : <p className="text-sm text-white/50">Все подходящие разделы уже добавлены.</p>}</div>
        </section>
        {showPreview && <section className="rounded-2xl border border-white/10 p-4 space-y-3"><h3 className="font-semibold">Предпросмотр бокового меню</h3><div className="max-w-xs rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">{items.map((it, i) => <div key={i} className="rounded-lg px-3 py-2 text-sm flex gap-3"><span className="text-violet">◈</span><span className="break-words">{it.label || 'Без названия'}</span><span className="ml-auto text-xs opacity-40">{it.icon}</span></div>)}</div></section>}
        <section className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4"><button type="button" className="btn-ghost text-sm" onClick={() => { if (confirmReset) { persist(INITIAL); setConfirmReset(false); } else setConfirmReset(true); }}>{confirmReset ? 'Подтвердить восстановление' : 'Восстановить базовое меню'}</button>{confirmReset && <button type="button" className="btn-ghost" onClick={() => setConfirmReset(false)}>Отмена</button>}<p className="text-xs text-white/50">Восстановление заменит текущий список, но не сохранит его автоматически.</p></section>
    </div>;
}
