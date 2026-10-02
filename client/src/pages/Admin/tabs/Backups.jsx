import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';
import { fmtSize } from '../utils.js';

export default function Backups({ token }) {
    const [list, setList] = useState([]);
    const [info, setInfo] = useState(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);
    const [downloading, setDownloading] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [restoreTarget, setRestoreTarget] = useState(null);
    const [loadingInfo, setLoadingInfo] = useState(false);

    const loadList = () => api('/admin/backups', { token }).then(setList).catch(() => {});

    const loadInfo = async () => {
        setLoadingInfo(true);
        try {
            setInfo(await api('/admin/maintenance/dbinfo', { token }));
        } catch {
            setInfo(null);
        } finally {
            setLoadingInfo(false);
        }
    };

    useEffect(() => {
        loadList();
        loadInfo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const create = async (format) => {
        setShowCreate(false);
        setBusy(true);
        setMessage(null);
        try {
            const b = await api('/admin/backups', { method: 'POST', token, body: { format } });
            setMessage({ type: 'ok', text: `Создан бэкап: ${b.filename}` });
            await loadList();
            await loadInfo();
        } catch (e) {
            setMessage({ type: 'err', text: e.message });
        } finally {
            setBusy(false);
        }
    };

    const restore = async () => {
        if (!restoreTarget) return;
        setBusy(true);
        setMessage(null);
        try {
            const r = await api('/admin/backups/restore', { method: 'POST', token, body: { filename: restoreTarget } });
            setMessage({ type: 'ok', text: `Восстановлено. Страховочная копия: ${r.safetyBackup}. Перезапустите сервер.` });
            setRestoreTarget(null);
            await loadList();
            await loadInfo();
        } catch (e) {
            setMessage({ type: 'err', text: e.message });
        } finally {
            setBusy(false);
        }
    };

    const remove = async (filename) => {
        if (!confirm(`Удалить ${filename}?`)) return;
        try {
            await api(`/admin/backups/${encodeURIComponent(filename)}`, { method: 'DELETE', token });
            await loadList();
            await loadInfo();
        } catch (e) {
            setMessage({ type: 'err', text: e.message });
        }
    };

    const download = async (filename) => {
        setDownloading(filename);
        setMessage(null);
        try {
            const base = import.meta.env.VITE_API || 'http://localhost:4000/api';
            const res = await fetch(`${base}/admin/backups/${encodeURIComponent(filename)}/download`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
            });
            if (!res.ok) throw new Error(`Ошибка ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMessage({ type: 'ok', text: `Скачано: ${filename}` });
        } catch (e) {
            setMessage({ type: 'err', text: e.message });
        } finally {
            setDownloading(null);
        }
    };

    const vacuum = async () => {
        if (!confirm('Выполнить VACUUM ANALYZE?')) return;
        setBusy(true);
        setMessage(null);
        try {
            await api('/admin/maintenance/vacuum', { method: 'POST', token });
            setMessage({ type: 'ok', text: 'VACUUM ANALYZE выполнен' });
            await loadInfo();
        } catch (e) {
            setMessage({ type: 'err', text: e.message });
        } finally {
            setBusy(false);
        }
    };

    const tools = info?.tools;

    return (
        <div className="space-y-4">
            <div className="card p-5">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                    <div>
                        <div className="font-bold text-lg">🐘 PostgreSQL</div>
                        <div className="text-sm text-white/50 mt-1">
                            {loadingInfo && !info ? 'Загрузка…' : info ? info.version.split(' ').slice(0, 2).join(' ') : '—'}
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={loadInfo} disabled={loadingInfo} className="btn-ghost !py-2 text-sm">🔄</button>
                        <button onClick={vacuum} disabled={busy} className="btn-ghost !py-2 text-sm">🧹 VACUUM</button>
                    </div>
                </div>

                {info && (
                    <>
                        <div className="grid sm:grid-cols-3 gap-3 mb-4">
                            <div className="card p-3 bg-ink-700/50">
                                <div className="text-xs text-white/40 uppercase tracking-wider">Размер БД</div>
                                <div className="text-xl font-bold mt-1">{info.sizePretty}</div>
                                <div className="text-[10px] text-white/30">{info.sizeBytes.toLocaleString('ru-RU')} байт</div>
                            </div>
                            <div className="card p-3 bg-ink-700/50">
                                <div className="text-xs text-white/40 uppercase tracking-wider">Подключение</div>
                                <div className="font-mono text-sm mt-1 truncate">{info.user}@{info.host}:{info.port}</div>
                                <div className="text-[10px] text-white/30 truncate">{info.database}</div>
                            </div>
                            <div className="card p-3 bg-ink-700/50">
                                <div className="text-xs text-white/40 uppercase tracking-wider">Утилиты</div>
                                <div className="text-xs mt-1 space-y-0.5">
                                    <div className={tools?.pgDumpOk ? 'text-lime' : 'text-pink'}>{tools?.pgDumpOk ? '✓' : '✗'} pg_dump</div>
                                    <div className={tools?.pgRestoreOk ? 'text-lime' : 'text-pink'}>{tools?.pgRestoreOk ? '✓' : '✗'} pg_restore</div>
                                </div>
                            </div>
                        </div>

                        {info.tables?.length > 0 && (
                            <details>
                                <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60 select-none">
                                    Таблицы: {info.tables.length}
                                </summary>
                                <div className="mt-2 max-h-[280px] overflow-y-auto pr-1">
                                    {info.tables.map((t) => (
                                        <div key={t.name} className="grid grid-cols-[1fr_60px_80px_80px] gap-2 px-2 py-1.5 text-xs rounded-lg hover:bg-white/5">
                                            <span className="font-mono truncate">{t.name}</span>
                                            <span className="text-right tabular-nums">{t.liveRows.toLocaleString('ru-RU')}</span>
                                            <span className="text-right tabular-nums text-white/50">{fmtSize(t.heapBytes)}</span>
                                            <span className="text-right tabular-nums">{fmtSize(t.totalBytes)}</span>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </>
                )}

                {tools && (!tools.pgDumpOk || !tools.pgRestoreOk) && (
                    <div className="mt-3 text-xs text-pink bg-pink/10 rounded-xl p-3">
                        ⚠ Утилиты PostgreSQL не найдены. Проверьте путь <code>{tools.pgDumpPath}</code>.
                    </div>
                )}
            </div>

            <div className="card p-5">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                    <div>
                        <div className="font-bold text-lg">🗄️ Резервные копии</div>
                        <div className="text-sm text-white/50 mt-1">Custom (.dump) — для восстановления. Plain (.sql) — для просмотра.</div>
                    </div>
                    <div className="relative">
                        <button onClick={() => setShowCreate((v) => !v)} disabled={busy || (tools && !tools.pgDumpOk)} className="btn-primary">
                            {busy ? '…' : '＋ Создать бэкап'}
                        </button>
                        {showCreate && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowCreate(false)} />
                                <div className="absolute right-0 top-full mt-1 z-20 card p-1 w-56">
                                    <button onClick={() => create('custom')} className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5">
                                        <div className="font-semibold">🗜️ Custom (.dump)</div>
                                        <div className="text-xs text-white/40">Сжатый, для восстановления</div>
                                    </button>
                                    <button onClick={() => create('plain')} className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5">
                                        <div className="font-semibold">📄 Plain (.sql)</div>
                                        <div className="text-xs text-white/40">Текстовый, для просмотра</div>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {message && (
                    <div className={`mb-3 text-sm rounded-xl p-3 ${message.type === 'ok' ? 'text-lime bg-lime/10 border border-lime/30' : 'text-pink bg-pink/10 border border-pink/30'}`}>
                        {message.text}
                    </div>
                )}

                <div className="divide-y divide-white/5 -mx-2">
                    {list.length === 0 && <div className="p-6 text-center text-white/40">Бэкапов пока нет</div>}
                    {list.map((b) => (
                        <div key={b.filename} className="px-2 py-3 flex items-center gap-3 flex-wrap">
                            <div className="text-2xl shrink-0">{b.isSafety ? '🛟' : b.isAuto ? '⏰' : b.format === 'plain' ? '📄' : '🗜️'}</div>
                            <div className="flex-1 min-w-[200px]">
                                <div className="font-mono text-sm truncate">{b.filename}</div>
                                <div className="text-xs text-white/40">
                                    {new Date(b.createdAt).toLocaleString('ru-RU')} · {fmtSize(b.size)}
                                    {b.format === 'plain' && ' · текстовый'}
                                </div>
                            </div>
                            <button onClick={() => download(b.filename)} disabled={downloading === b.filename} className="chip bg-white/5 hover:bg-white/10">
                                {downloading === b.filename ? '⏳' : '⬇'}
                            </button>
                            <button onClick={() => setRestoreTarget(b.filename)} disabled={busy || !b.restorable} className={`chip ${b.restorable ? 'bg-violet/30 hover:bg-violet/50' : 'bg-white/5 opacity-40 cursor-not-allowed'}`}>
                                ↺ Восстановить
                            </button>
                            <button onClick={() => remove(b.filename)} disabled={busy} className="chip bg-white/5 hover:bg-pink/30">🗑️</button>
                        </div>
                    ))}
                </div>
            </div>

            {restoreTarget && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={() => !busy && setRestoreTarget(null)}>
                    <div className="card max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
                        <div className="text-2xl mb-2">⚠️</div>
                        <h3 className="text-xl font-bold mb-3">Восстановить базу?</h3>
                        <p className="text-sm text-white/70 mb-4">
                            Текущее содержимое БД будет заменено данными из <span className="font-mono text-white">{restoreTarget}</span>. Будет создана страховочная копия <span className="font-mono">pre-restore_*</span>.
                        </p>
                        <p className="text-sm text-orange-300 mb-4">После восстановления требуется перезапуск backend.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setRestoreTarget(null)} disabled={busy} className="btn-ghost">Отмена</button>
                            <button onClick={restore} disabled={busy} className="btn-primary">{busy ? 'Восстановление…' : '↺ Восстановить'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}