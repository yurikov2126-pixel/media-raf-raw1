import { useMemo, useState } from 'react';
import { api } from '../../../api/client.js';
import ConfirmDialog from './ConfirmDialog.jsx';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif']);

function formatBytes(b) {
    if (!b) return '0 Б';
    const u = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
    return (b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
}

function formatDate(s) {
    if (!s) return '—';
    return new Date(s).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export default function OrphanFilesList({ details, token, onChanged }) {
    const items = details?.items || [];
    const [selected, setSelected] = useState(() => new Set());
    const [query, setQuery] = useState('');
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const [confirm, setConfirm] = useState(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter((f) => f.filename.toLowerCase().includes(q));
    }, [items, query]);

    const allChecked = filtered.length > 0 && filtered.every((f) => selected.has(f.filename));
    const someChecked = filtered.some((f) => selected.has(f.filename));

    const toggle = (name) =>
        setSelected((s) => {
            const n = new Set(s);
            if (n.has(name)) n.delete(name); else n.add(name);
            return n;
        });

    const toggleAll = () =>
        setSelected((s) => {
            const n = new Set(s);
            if (allChecked) filtered.forEach((f) => n.delete(f.filename));
            else filtered.forEach((f) => n.add(f.filename));
            return n;
        });

    const doDelete = async (filenames) => {
        setBusy(true);
        setMsg('');
        try {
            if (filenames.length === 1) {
                await api(
                    `/admin/maintenance/orphaned-files/${encodeURIComponent(filenames[0])}`,
                    { method: 'DELETE', token }
                );
                setMsg(`🗑️ Удалён: ${filenames[0]}`);
            } else {
                const r = await api('/admin/maintenance/orphaned-files/purge', {
                    method: 'POST',
                    token,
                    body: { filenames },
                });
                setMsg(
                    `🗑️ Удалено: ${r.deletedCount}` +
                    (r.failedCount ? `, ошибок: ${r.failedCount}` : '') +
                    `, освобождено ${formatBytes(r.freedBytes)}`
                );
            }
            setSelected(new Set());
            onChanged?.();
        } catch (e) {
            setMsg('Ошибка: ' + e.message);
        } finally {
            setBusy(false);
        }
    };

    const doPurgeOld = async (days) => {
        setBusy(true);
        setMsg('');
        try {
            const r = await api('/admin/maintenance/orphaned-files/purge', {
                method: 'POST',
                token,
                body: { olderThanDays: days },
            });
            setMsg(
                `🗑️ Удалено: ${r.deletedCount} файлов старше ${days} дн., ` +
                `освобождено ${formatBytes(r.freedBytes)}`
            );
            setSelected(new Set());
            onChanged?.();
        } catch (e) {
            setMsg('Ошибка: ' + e.message);
        } finally {
            setBusy(false);
        }
    };

    if (!items.length) {
        return (
            <div className="rounded-2xl bg-ink-700/50 p-4 text-sm text-white/50">
                ✓ Осиротевших файлов не найдено
            </div>
        );
    }

    return (
        <div className="rounded-2xl bg-ink-700/50 p-3 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm">
                    <b>{details.totalCount ?? items.length}</b>{' '}
                    {items.length === 1 ? 'файл' : 'файлов'}
                    {details.totalSize > 0 && <> · {formatBytes(details.totalSize)}</>}
                    {details.truncated && (
                        <span className="ml-2 text-orange-300 text-xs">
                            (показаны первые {items.length})
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    <input
                        className="input !py-1.5 !text-sm !w-48"
                        placeholder="Поиск по имени…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button
                        onClick={() => setConfirm({ mode: 'old', days: 30 })}
                        disabled={busy}
                        className="btn-ghost !py-1.5 text-xs"
                        title="Удалить все осиротевшие старше 30 дней"
                    >
                        Старше 30 дн.
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-xs text-white/40 uppercase tracking-wider">
                    <tr className="border-b border-white/10">
                        <th className="text-left p-2 w-8">
                            <input
                                type="checkbox"
                                checked={allChecked}
                                ref={(el) => {
                                    if (el) el.indeterminate = !allChecked && someChecked;
                                }}
                                onChange={toggleAll}
                            />
                        </th>
                        <th className="text-left p-2">Файл</th>
                        <th className="text-right p-2 w-24">Размер</th>
                        <th className="text-left p-2 w-40">Дата</th>
                        <th className="text-right p-2 w-24">Действия</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filtered.map((f) => (
                        <tr key={f.filename} className="border-b border-white/5 hover:bg-white/5">
                            <td className="p-2">
                                <input
                                    type="checkbox"
                                    checked={selected.has(f.filename)}
                                    onChange={() => toggle(f.filename)}
                                />
                            </td>
                            <td className="p-2">
                                <div className="font-mono text-xs break-all">{f.filename}</div>
                            </td>
                            <td className="p-2 text-right text-white/60">{formatBytes(f.size)}</td>
                            <td className="p-2 text-white/60 text-xs">{formatDate(f.mtime)}</td>
                            <td className="p-2 text-right">
                                <div className="inline-flex gap-2">
                                    {IMAGE_EXTS.has(f.ext) && (
                                        <button
                                            onClick={() => setPreview(f)}
                                            className="text-xs text-violet-soft hover:underline"
                                            title="Превью"
                                        >
                                            👁
                                        </button>
                                    )}
                                    <a
                                        href={f.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-white/60 hover:underline"
                                        title="Открыть"
                                    >
                                        ↗
                                    </a>
                                    <button
                                        onClick={() =>
                                            setConfirm({ mode: 'single', filename: f.filename })
                                        }
                                        disabled={busy}
                                        className="text-xs text-pink hover:underline"
                                        title="Удалить"
                                    >
                                        🗑
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {filtered.length === 0 && query && (
                <div className="text-center text-white/40 text-sm py-3">
                    Ничего не найдено по «{query}»
                </div>
            )}

            {selected.size > 0 && (
                <div className="flex items-center gap-2 flex-wrap border-t border-white/10 pt-3">
                    <div className="text-sm">
                        Выбрано: <b>{selected.size}</b>
                    </div>
                    <div className="flex-1" />
                    <button
                        onClick={() => setSelected(new Set())}
                        disabled={busy}
                        className="btn-ghost !py-1.5 text-xs"
                    >
                        Снять выделение
                    </button>
                    <button
                        onClick={() =>
                            setConfirm({ mode: 'bulk', filenames: Array.from(selected) })
                        }
                        disabled={busy}
                        className="btn-primary !bg-pink !py-1.5 text-xs"
                    >
                        🗑 Удалить выбранные ({selected.size})
                    </button>
                </div>
            )}

            {msg && <div className="text-sm bg-white/5 rounded-xl p-2">{msg}</div>}

            {preview && (
                <div
                    className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm grid place-items-center p-4"
                    onClick={() => setPreview(null)}
                >
                    <div className="max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={preview.url}
                            alt={preview.filename}
                            className="max-h-[80vh] rounded-xl"
                        />
                        <div className="text-center text-white/60 text-xs mt-2 font-mono">
                            {preview.filename}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={!!confirm}
                title={
                    confirm?.mode === 'single'
                        ? 'Удалить файл?'
                        : confirm?.mode === 'bulk'
                            ? `Удалить ${confirm.filenames.length} файлов?`
                            : `Удалить все старше ${confirm?.days} дней?`
                }
                description={
                    confirm?.mode === 'single'
                        ? `Файл «${confirm.filename}» будет удалён с диска. Это необратимо.`
                        : 'Файлы будут удалены с диска. Это необратимо.'
                }
                confirmLabel="Удалить"
                danger
                busy={busy}
                onConfirm={async () => {
                    const c = confirm;
                    setConfirm(null);
                    if (c.mode === 'single') await doDelete([c.filename]);
                    else if (c.mode === 'bulk') await doDelete(c.filenames);
                    else await doPurgeOld(c.days);
                }}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}