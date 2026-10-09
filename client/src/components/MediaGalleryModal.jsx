import { useEffect, useMemo, useState } from 'react';
import { api, resolveUrl } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import ImageViewer from './ImageViewer.jsx';

const TABS = [
    { v: 'image', l: '🖼️ Фото' },
    { v: 'video', l: '🎥 Видео' },
    { v: 'voice', l: '🎤 Голосовые' },
    { v: 'file', l: '📎 Файлы' },
];
const dateLabel = (value) => new Date(value).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
const fileName = (url) => {
    try { return decodeURIComponent(new URL(url, window.location.origin).pathname.split('/').pop() || 'Документ'); }
    catch { return 'Документ'; }
};

export default function MediaGalleryModal({ chatId, onClose, onJumpToMessage }) {
    const { token } = useAuth();
    const [tab, setTab] = useState('image');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [viewerIndex, setViewerIndex] = useState(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        setItems([]);
        api(`/chats/${chatId}/media?type=${tab}`, { token })
            .then((data) => { if (active) setItems(data); })
            .catch(() => { if (active) setError('Не удалось загрузить вложения'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [chatId, tab, token]);

    useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape' && viewerIndex === null) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, viewerIndex]);

    const images = useMemo(() => items.filter((m) => m.type === 'image'), [items]);
    const filtered = useMemo(() => items.filter((m) => tab !== 'file' || !search.trim() ||
        fileName(m.content).toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru'))), [items, tab, search]);
    const groups = useMemo(() => {
        const map = new Map();
        for (const item of filtered) {
            const label = dateLabel(item.createdAt);
            if (!map.has(label)) map.set(label, []);
            map.get(label).push(item);
        }
        return Array.from(map.entries());
    }, [filtered]);

    const jump = (id) => {
        onClose();
        onJumpToMessage?.(id);
    };

    return (
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 md:p-5"
            role="dialog" aria-modal="true" aria-label="Медиа и файлы" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden rounded-2xl border shadow-2xl"
                style={{ backgroundColor: 'var(--bg-elev-1)', color: 'var(--text-primary)', borderColor: 'var(--border-strong)' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-strong)' }}>
                    <div>
                        <div className="font-bold">Медиа и файлы</div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{loading ? 'Загрузка…' : `${items.length} материалов · последние 300`}</div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Закрыть галерею" className="rounded-xl px-3 py-2 hover:bg-white/10">✕</button>
                </div>
                <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b" style={{ borderColor: 'var(--border-strong)' }}>
                    {TABS.map((t) => <button key={t.v} type="button" onClick={() => { setTab(t.v); setSearch(''); setViewerIndex(null); }}
                        aria-pressed={tab === t.v}
                        className="shrink-0 rounded-full px-3 py-2 text-sm font-medium"
                        style={{ backgroundColor: tab === t.v ? 'var(--bg-elev-3)' : 'var(--bg-elev-2)', color: 'var(--text-primary)' }}>{t.l}</button>)}
                </div>
                {tab === 'file' && <div className="px-4 pt-3"><input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Фильтр по имени файла…" aria-label="Фильтр файлов"
                    className="w-full rounded-xl border px-3 py-2 bg-transparent" style={{ borderColor: 'var(--border-strong)' }} /></div>}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 overscroll-contain">
                    {loading && <div role="status" className="text-center py-10">Загрузка…</div>}
                    {error && <div role="alert" className="text-center py-10">{error}</div>}
                    {!loading && !error && filtered.length === 0 && <div className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>Здесь пока нет материалов</div>}
                    {!loading && !error && groups.map(([date, group]) => (
                        <section key={date} className="mb-6">
                            <h3 className="mb-3 text-sm font-semibold capitalize" style={{ color: 'var(--text-secondary)' }}>{date} · {group.length}</h3>
                            {tab === 'image' && <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                {group.map((m) => <button key={m.id} type="button" onClick={() => setViewerIndex(images.findIndex((x) => x.id === m.id))}
                                    aria-label={`Открыть фото от ${m.sender?.fullName || 'участника'}`} className="aspect-square rounded-xl overflow-hidden focus-visible:outline-2 focus-visible:outline-violet">
                                    <img src={resolveUrl(m.content)} alt="" loading="lazy" className="h-full w-full object-cover hover:scale-105 transition-transform" />
                                </button>)}
                            </div>}
                            {tab === 'video' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {group.map((m) => <div key={m.id} className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-strong)' }}>
                                    <video src={resolveUrl(m.content)} controls preload="metadata" playsInline className="w-full max-h-64 bg-black" />
                                    <button type="button" onClick={() => jump(m.id)} className="w-full px-3 py-2 text-left text-xs hover:underline">Перейти к сообщению ↗</button>
                                </div>)}
                            </div>}
                            {(tab === 'file' || tab === 'voice') && <div className="space-y-2">
                                {group.map((m) => <div key={m.id} className="flex items-center gap-3 rounded-xl border p-3 min-w-0" style={{ borderColor: 'var(--border-strong)' }}>
                                    <span className="text-2xl shrink-0">{tab === 'voice' ? '🎤' : '📄'}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-semibold">{tab === 'voice' ? 'Голосовое сообщение' : fileName(m.content)}</div>
                                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.sender?.fullName || 'Участник'} · {new Date(m.createdAt).toLocaleString('ru-RU')}</div>
                                    </div>
                                    <a href={resolveUrl(m.content)} target="_blank" rel="noopener noreferrer"
                                        aria-label={tab === 'voice' ? 'Открыть голосовое сообщение' : 'Открыть или скачать файл'} className="rounded-lg px-2 py-2 hover:bg-white/10">↗</a>
                                    <button type="button" onClick={() => jump(m.id)} title="К сообщению" aria-label="Перейти к сообщению" className="rounded-lg px-2 py-2 hover:bg-white/10">💬</button>
                                </div>)}
                            </div>}
                        </section>
                    ))}
                </div>
            </div>
            {viewerIndex !== null && images.length > 0 && <ImageViewer images={images.map((m) => ({ id: m.id, url: resolveUrl(m.content) }))}
                startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />}
        </div>
    );
}
