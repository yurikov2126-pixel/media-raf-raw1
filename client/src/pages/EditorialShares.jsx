import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const shareUrl = token => window.location.origin + '/share/editorial/' + token;
export default function EditorialShares() {
    const { token } = useAuth();
    const [shares, setShares] = useState([]);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        let active = true;
        api('/editorial/library/shares', { token }).then(result => {
            if (active) { setShares((result.shares || []).filter(item => !item.revokedAt)); setError(''); }
        }).catch(e => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [token, refresh]);
    async function revoke(share) {
        if (!window.confirm('Отозвать ссылку «' + share.title + '»? Доступ по ней прекратится немедленно.')) return;
        setBusyId(share.id);
        try {
            await api('/editorial/library/shares/' + share.id + '/revoke', { token, method: 'POST' });
            setShares(items => items.filter(item => item.id !== share.id));
        } catch (e) { setError(e.message); }
        finally { setBusyId(null); }
    }
    return <div className="editorial-workspace-content space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-semibold">Общие ссылки</h2><p className="text-sm opacity-75">Управление ссылками на материалы. Создавать новые ссылки можно в разделе «Файлы».</p></div>
            <button type="button" className="rounded-xl border border-violet-400 px-4 py-2 text-sm font-semibold" onClick={() => setRefresh(n => n + 1)}>Обновить</button>
        </header>
        {error && <p role="alert" className="rounded-xl border border-red-500 p-3">{error}</p>}
        <div className="space-y-3">
            {shares.map(share => {
                const expired = !!share.expiresAt && new Date(share.expiresAt) <= new Date();
                return <article key={share.id} className="rounded-xl border border-current/20 bg-violet-500/5 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{share.title}</h3><p className="mt-1 text-xs opacity-80">{share.fileIds.length} файлов · {expired ? 'Срок истёк' : share.expiresAt ? 'Доступна до ' + new Date(share.expiresAt).toLocaleDateString('ru-RU') : 'Без срока'}</p></div><span className={expired ? 'text-xs font-semibold text-amber-600 dark:text-amber-300' : 'text-xs font-semibold text-emerald-700 dark:text-emerald-300'}>{expired ? 'Истекла' : 'Активна'}</span></div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {!expired && <><a href={shareUrl(share.token)} target="_blank" rel="noreferrer" className="rounded-lg border border-violet-400 px-3 py-2 text-sm">Открыть ↗</a><button type="button" className="rounded-lg border border-violet-400 px-3 py-2 text-sm" onClick={() => navigator.clipboard.writeText(shareUrl(share.token)).catch(() => setError('Не удалось скопировать ссылку'))}>Копировать</button></>}
                        <button type="button" disabled={busyId === share.id} className="rounded-lg border border-rose-400 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50 dark:text-rose-200" onClick={() => revoke(share)}>{busyId === share.id ? 'Отзываем…' : 'Отозвать ссылку'}</button>
                    </div>
                </article>;
            })}
            {!shares.length && !error && <p className="rounded-xl border border-dashed border-current/25 p-6 text-center text-sm opacity-75">Общих ссылок пока нет. Создайте ссылку в разделе «Файлы».</p>}
        </div>
    </div>;
}
