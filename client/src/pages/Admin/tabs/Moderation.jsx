import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, resolveUrl } from '../../../api/client.js';
import { useToast } from '../../../store/toast.jsx';
import Avatar from '../../../components/Avatar.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const REASON_LABEL = {
    spam: '📢 Спам',
    abuse: '⚠️ Оскорбления',
    illegal: '🚫 Противозаконное',
    other: '❓ Другое',
};

const STATUS_LABEL = {
    NEW: '🆕 Новые',
    IN_REVIEW: '👀 В работе',
    RESOLVED: '✅ Решены',
    REJECTED: '✕ Отклонены',
};

const TARGET_LABEL = {
    post: '📝 Пост',
    comment: '💬 Комментарий',
    message: '✉️ Сообщение',
    user: '👤 Пользователь',
};

const STATUSES = ['NEW', 'IN_REVIEW', 'RESOLVED', 'REJECTED', ''];

export default function Moderation({ token, onChanged }) {
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();

    const status = searchParams.get('status') ?? 'NEW';
    const targetType = searchParams.get('target') ?? '';
    const page = Math.max(1, Number(searchParams.get('page')) || 1);

    const updateFilters = (patch) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                for (const [k, v] of Object.entries(patch)) {
                    if (v === '' || v === null || v === undefined) next.delete(k);
                    else next.set(k, String(v));
                }
                if (!('page' in patch)) next.delete('page');
                return next;
            },
            { replace: true }
        );
    };

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [open, setOpen] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const q = new URLSearchParams({ page: String(page), limit: '20' });
            if (status) q.set('status', status);
            if (targetType) q.set('targetType', targetType);
            const r = await api(`/admin/reports?${q}`, { token });
            setData(r);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, targetType, page]);

    const apply = async (reportId, action, payload) => {
        setBusy(true);
        try {
            if (action === 'status') {
                await api(`/admin/reports/${reportId}`, {
                    method: 'PATCH',
                    token,
                    body: payload,
                });
                toast.success('Статус обновлён');
            } else if (action === 'delete') {
                await api(`/admin/reports/${reportId}/delete-content`, {
                    method: 'POST',
                    token,
                });
                toast.success('Контент удалён');
            } else if (action === 'ban') {
                await api(`/admin/reports/${reportId}/ban-user`, {
                    method: 'POST',
                    token,
                });
                toast.success('Пользователь заблокирован');
            } else if (action === 'remove-report') {
                await api(`/admin/reports/${reportId}`, { method: 'DELETE', token });
                toast.success('Жалоба удалена');
            }
            setConfirm(null);
            setOpen(null);
            await load();
            onChanged?.();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="card p-4 flex flex-wrap gap-2 items-center">
                <div className="font-bold text-lg mr-2">🛡️ Модерация жалоб</div>
                {STATUSES.map((s) => (
                    <button
                        key={s || 'all'}
                        onClick={() => updateFilters({ status: s })}
                        className={`chip ${
                            status === s ? 'bg-violet text-white' : 'bg-white/5 text-white/60'
                        }`}
                    >
                        {s ? STATUS_LABEL[s] : 'Все'}
                    </button>
                ))}
                <select
                    className="input !py-2 !w-auto ml-auto"
                    value={targetType}
                    onChange={(e) => updateFilters({ target: e.target.value })}
                >
                    <option value="">Все типы</option>
                    <option value="post">Посты</option>
                    <option value="comment">Комментарии</option>
                    <option value="message">Сообщения</option>
                    <option value="user">Пользователи</option>
                </select>
                <button onClick={load} disabled={loading} className="btn-ghost !py-2">
                    {loading ? '⏳' : '🔄'}
                </button>
            </div>

            {error && <div className="card p-4 text-pink">{error}</div>}

            {data && (
                <>
                    <div className="text-sm text-white/50 px-1">
                        Всего: {data.total} · Страница {data.page} из{' '}
                        {Math.max(1, data.pages)}
                    </div>

                    <div className="card divide-y divide-white/5">
                        {data.items.length === 0 && (
                            <div className="p-8 text-center text-white/40">Жалоб нет</div>
                        )}
                        {data.items.map((r) => (
                            <div key={r.id} className="p-4">
                                <div className="flex items-start gap-3 flex-wrap">
                                    <div className="text-2xl shrink-0">
                                        {TARGET_LABEL[r.targetType]?.split(' ')[0] || '❓'}
                                    </div>
                                    <div className="flex-1 min-w-[240px]">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="chip bg-violet/20 text-violet-soft text-[10px]">
                                                {REASON_LABEL[r.reason] || r.reason}
                                            </span>
                                            <span className="chip bg-white/5 text-[10px]">
                                                {TARGET_LABEL[r.targetType]}
                                            </span>
                                            <span className="text-[10px] text-white/30">
                                                {new Date(r.createdAt).toLocaleString('ru-RU')}
                                            </span>
                                        </div>
                                        <div className="text-sm text-white/70">
                                            Жалоба от <b>{r.reporter.fullName}</b> (@
                                            {r.reporter.username})
                                        </div>
                                        {r.comment && (
                                            <div className="text-xs text-white/60 mt-1 italic">
                                                «{r.comment}»
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={() => setOpen(r)}
                                            className="chip bg-white/5 hover:bg-white/10 text-xs"
                                        >
                                            Открыть
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {data.pages > 1 && (
                        <div className="flex justify-center gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => updateFilters({ page: page - 1 })}
                                className="btn-ghost !py-2 disabled:opacity-30"
                            >
                                ← Назад
                            </button>
                            <div className="self-center text-sm text-white/50">
                                {page} / {data.pages}
                            </div>
                            <button
                                disabled={page >= data.pages}
                                onClick={() => updateFilters({ page: page + 1 })}
                                className="btn-ghost !py-2 disabled:opacity-30"
                            >
                                Вперёд →
                            </button>
                        </div>
                    )}
                </>
            )}

            {open && (
                <ReportDetail
                    report={open}
                    token={token}
                    busy={busy}
                    onClose={() => setOpen(null)}
                    onStatus={(s, resolution) =>
                        apply(open.id, 'status', { status: s, resolution })
                    }
                    onDeleteContent={() => setConfirm({ type: 'delete', report: open })}
                    onBanUser={() => setConfirm({ type: 'ban', report: open })}
                    onRemoveReport={() =>
                        setConfirm({ type: 'remove-report', report: open })
                    }
                />
            )}

            <ConfirmDialog
                open={!!confirm}
                title={
                    confirm?.type === 'delete'
                        ? 'Удалить контент?'
                        : confirm?.type === 'ban'
                            ? 'Заблокировать автора?'
                            : 'Удалить жалобу?'
                }
                description={
                    confirm?.type === 'delete'
                        ? 'Объект будет удалён, все связанные жалобы закрыты как решённые.'
                        : confirm?.type === 'ban'
                            ? 'Пользователь будет заблокирован. Все его действия останутся в базе.'
                            : 'Жалоба будет удалена из очереди без изменения статуса объекта.'
                }
                confirmLabel="Подтвердить"
                danger
                busy={busy}
                onConfirm={() => apply(confirm.report.id, confirm.type)}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}

function ReportDetail({
                          report,
                          busy,
                          onClose,
                          onStatus,
                          onDeleteContent,
                          onBanUser,
                          onRemoveReport,
                      }) {
    const [resolution, setResolution] = useState(report.resolution || '');

    const target = report.target?.data;
    const author =
        target?.author || target?.sender || (report.targetType === 'user' ? target : null);

    return (
        <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto p-4"
            onClick={onClose}
        >
            <div
                className="card max-w-3xl mx-auto my-8 p-5"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">🛡️ Жалоба</h2>
                    <button
                        onClick={onClose}
                        className="text-white/40 hover:text-white text-xl"
                    >
                        ✕
                    </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mb-4 text-sm">
                    <div>
                        <div className="text-xs text-white/40 uppercase">Тип</div>
                        <div>{TARGET_LABEL[report.targetType]}</div>
                    </div>
                    <div>
                        <div className="text-xs text-white/40 uppercase">Причина</div>
                        <div>{REASON_LABEL[report.reason]}</div>
                    </div>
                    <div>
                        <div className="text-xs text-white/40 uppercase">От</div>
                        <div className="flex items-center gap-2">
                            <Avatar user={report.reporter} size={24} />
                            <span>{report.reporter.fullName}</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-white/40 uppercase">Когда</div>
                        <div>{new Date(report.createdAt).toLocaleString('ru-RU')}</div>
                    </div>
                </div>

                {report.comment && (
                    <div className="mb-4 p-3 rounded-xl bg-white/5 text-sm italic">
                        «{report.comment}»
                    </div>
                )}

                <div className="mb-4">
                    <div className="text-xs text-white/40 uppercase mb-2">Содержимое</div>
                    {!target ? (
                        <div className="text-white/40 text-sm p-3 rounded-xl bg-white/5">
                            Объект уже удалён
                        </div>
                    ) : report.targetType === 'post' ? (
                        <div className="p-3 rounded-xl bg-white/5 text-sm">
                            {target.content || '(без текста)'}
                            {target.mediaUrl && (
                                <img
                                    src={resolveUrl(target.mediaUrl)}
                                    alt=""
                                    className="mt-2 rounded-xl max-h-60"
                                />
                            )}
                        </div>
                    ) : report.targetType === 'comment' ? (
                        <div className="p-3 rounded-xl bg-white/5 text-sm">
                            {target.content}
                        </div>
                    ) : report.targetType === 'message' ? (
                        <div className="p-3 rounded-xl bg-white/5 text-sm">
                            <b>Тип:</b> {target.type} · <b>Содержимое:</b>{' '}
                            {target.type === 'text'
                                ? target.content
                                : `[${target.type}] ${target.content}`}
                        </div>
                    ) : (
                        <div className="p-3 rounded-xl bg-white/5 text-sm">
                            <div>
                                <b>@{target.username}</b>
                            </div>
                            <div>{target.fullName}</div>
                            {target.isBanned && <div className="text-pink">забанен</div>}
                        </div>
                    )}
                </div>

                {author && (
                    <div className="mb-4">
                        <div className="text-xs text-white/40 uppercase mb-2">Автор</div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                            <Avatar user={author} size={36} />
                            <div>
                                <div className="font-semibold">{author.fullName}</div>
                                <div className="text-xs text-white/40">
                                    @{author.username}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mb-4">
                    <label className="text-xs text-white/40 uppercase block mb-1">
                        Резолюция
                    </label>
                    <textarea
                        className="input resize-none"
                        rows={2}
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        placeholder="Комментарий для истории (необязательно)"
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => onStatus('IN_REVIEW', resolution)}
                        disabled={busy}
                        className="btn-ghost"
                    >
                        👀 В работу
                    </button>
                    <button
                        onClick={() => onStatus('RESOLVED', resolution)}
                        disabled={busy}
                        className="btn-ghost"
                    >
                        ✅ Решено
                    </button>
                    <button
                        onClick={() => onStatus('REJECTED', resolution)}
                        disabled={busy}
                        className="btn-ghost"
                    >
                        ✕ Отклонить
                    </button>
                    <div className="ml-auto flex gap-2">
                        <button
                            onClick={onRemoveReport}
                            disabled={busy}
                            className="btn-ghost text-pink"
                        >
                            Удалить жалобу
                        </button>
                        {target && (
                            <>
                                <button
                                    onClick={onBanUser}
                                    disabled={busy}
                                    className="btn-primary !bg-pink"
                                >
                                    🚫 Забанить
                                </button>
                                <button
                                    onClick={onDeleteContent}
                                    disabled={busy}
                                    className="btn-primary"
                                >
                                    🗑️ Удалить контент
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}