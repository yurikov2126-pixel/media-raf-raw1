import { useState } from 'react';
import IconPicker from './IconPicker.jsx';
import MenuPreview from './MenuPreview.jsx';

const DEFAULT_DESKTOP = [
    { to: '/app', label: 'Главная', icon: 'dashboard', end: true },
    { to: '/app/feed', label: 'Лента', icon: 'feed' },
    { to: '/app/chats', label: 'Чаты', icon: 'message' },
    { to: '/app/courses', label: 'Обучение', icon: 'book' },
    { to: '/app/wiki', label: 'Wiki', icon: 'library' },
    { to: '/app/editorial', label: 'Редакция', icon: 'newspaper' },
    { to: '/app/leaderboard', label: 'Рейтинг', icon: 'trophy' },
    { to: '/app/mentor', label: 'Руководителю', icon: 'users', roles: ['MENTOR', 'ADMIN'] },
    { to: '/app/admin', label: 'Админка', icon: 'settings', roles: ['ADMIN'] },
];
const DEFAULT_MOBILE = [
    { to: '/app', label: 'Главная', icon: 'dashboard' },
    { to: '/app/feed', label: 'Лента', icon: 'feed' },
    { to: '/app/u/me', label: 'Профиль', icon: 'user' },
    { to: '/app/chats', label: 'Чаты', icon: 'message' },
    { action: 'more', label: 'Ещё', icon: 'more' },
];
const DEFAULT_EXTRA = [
    { to: '/app/courses', label: 'Обучение', icon: 'book' },
    { to: '/app/wiki', label: 'Wiki', icon: 'library' },
    { to: '/app/editorial', label: 'Редакция', icon: 'book' },
    { to: '/app/leaderboard', label: 'Рейтинг', icon: 'trophy' },
    { to: '/app/notifications', label: 'Уведомления', icon: 'bell' },
    { to: '/app/mentor', label: 'Руководителю', icon: 'users', roles: ['MENTOR', 'ADMIN'] },
    { to: '/app/admin', label: 'Админка', icon: 'settings', roles: ['ADMIN'] },
];
const parse = (raw, fallback) => { try { const v = JSON.parse(raw || 'null'); return Array.isArray(v) ? v : fallback; } catch { return fallback; } };
const CONFIG = {
    desktop: { key: 'nav_items', label: 'ПК · боковое меню' },
    mobile: { key: 'nav_mobile_items', extra: 'nav_mobile_more_items', label: 'Мобильный браузер' },
    pwa: { key: 'nav_pwa_items', extra: 'nav_pwa_more_items', label: 'PWA · установленное приложение' },
};
function ItemsEditor({ items, onChange, mobile = false, more = false }) {
    const patch = (i, p) => onChange(items.map((x, j) => i === j ? { ...x, ...p } : x));
    const move = (i, step) => { const j = i + step; if (j < 0 || j >= items.length) return; const a = [...items]; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
    return <div className="space-y-2">
        {items.map((item, i) => <div key={i} className="card p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="text-xs text-white/60">Иконка<IconPicker value={item.icon} onChange={icon => patch(i, { icon })}/></div>
                <label className="text-xs text-white/60">Название<input className="input mt-1" value={item.label || ''} onChange={e => patch(i, { label: e.target.value })} /></label>
                <label className="text-xs text-white/60">Адрес<input className="input mt-1" value={item.action === 'more' ? 'Открыть «Ещё»' : item.to || ''} disabled={item.action === 'more'} onChange={e => patch(i, { to: e.target.value })} placeholder="/app/..." /></label>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
                <button type="button" className="btn-ghost !py-1 text-xs" disabled={!i} onClick={() => move(i, -1)}>↑ Выше</button>
                <button type="button" className="btn-ghost !py-1 text-xs" disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓ Ниже</button>
                <button type="button" className="btn-ghost !py-1 text-xs text-pink" onClick={() => onChange(items.filter((_, j) => i !== j))}>Удалить</button>
                {mobile && !more && <span className="text-xs text-white/40">В нижней панели рекомендуется не больше 5 пунктов</span>}
            </div>
        </div>)}
        <button type="button" className="btn-ghost text-sm" onClick={() => onChange([...items, { to: '/app', label: 'Новый пункт', icon: 'dashboard' }])}>＋ Добавить пункт</button>
    </div>;
}
export default function MenuEditor({ settings, update }) {
    const [device, setDevice] = useState('desktop');
    const [area, setArea] = useState('primary');
    const cfg = CONFIG[device];
    const key = area === 'extra' && cfg.extra ? cfg.extra : cfg.key;
    const fallback = device === 'desktop' ? DEFAULT_DESKTOP : area === 'extra' ? DEFAULT_EXTRA : DEFAULT_MOBILE;
    const saved = parse(settings[key], fallback);
    const items = device === 'desktop' && settings.nav_desktop_customized !== 'true'
        ? [...saved, ...DEFAULT_DESKTOP.filter(item => !saved.some(existing => existing.to === item.to))]
        : saved;
    const previewPrimary = device === 'desktop' ? items : parse(settings[cfg.key], DEFAULT_MOBILE);
    const previewExtra = device === 'desktop' ? [] : parse(settings[cfg.extra], DEFAULT_EXTRA);
    const setItems = (value) => update({ [key]: JSON.stringify(value), ...(device === 'desktop' ? { nav_desktop_customized: 'true' } : {}) });
    return <div className="space-y-5">
        <div><h3 className="font-semibold">Настройка навигации для разных устройств</h3><p className="text-sm text-white/50">Каждый вариант сохраняется отдельно. Права доступа проверяются сайтом независимо от меню.</p></div>
        <div className="flex flex-wrap gap-2">{Object.entries(CONFIG).map(([value, c]) => <button type="button" key={value} aria-pressed={device === value} className={device === value ? 'chip bg-violet text-white' : 'chip bg-white/5'} onClick={() => { setDevice(value); setArea('primary'); }}>{c.label}</button>)}</div>
        {cfg.extra && <div className="flex gap-2"><button type="button" className={area === 'primary' ? 'chip bg-violet text-white' : 'chip bg-white/5'} onClick={() => setArea('primary')}>Нижняя панель</button><button type="button" className={area === 'extra' ? 'chip bg-violet text-white' : 'chip bg-white/5'} onClick={() => setArea('extra')}>Меню «Ещё»</button></div>}
        <div className="rounded-xl border border-white/10 p-3 text-xs text-white/60">{device === 'desktop' ? 'Полный список пунктов реального бокового меню. Системные разделы также можно переставлять или скрывать; доступ по ролям остаётся защищённым.' : area === 'primary' ? 'Пункты нижней панели. Для открытия дополнительного меню оставьте пункт с действием «Ещё».' : 'Пункты, которые открываются в меню «Ещё».'}</div>
        <MenuPreview device={device} primary={previewPrimary} extra={previewExtra} settings={settings}/>
        <ItemsEditor key={key} items={items} onChange={setItems} mobile={device !== 'desktop'} more={area === 'extra'}/>
        <button type="button" className="btn-ghost text-xs" onClick={() => update({ [key]: JSON.stringify(fallback), ...(device === 'desktop' ? { nav_desktop_customized: 'true' } : {}) })}>Восстановить стандартные пункты</button>
    </div>;
}
