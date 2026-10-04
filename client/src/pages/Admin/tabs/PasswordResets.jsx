import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';
import Avatar from '../../../components/Avatar.jsx';

const STATUS_LABEL = {
    PENDING: '🆕 Ожидает',
    CODE_ISSUED: '📱 Код выдан',
    COMPLETED: '✅ Завершено',
    REJECTED: '✕ Отклонено',
    EXPIRED: '⏳ Устарело',
};

const FILTERS = [
    ['PENDING', 'Ожидают'],
    ['CODE_ISSUED', 'Код выдан'],
    ['COMPLETED', 'Завершены'],
    ['REJECTED', 'Отклонены'],
    ['', 'Все'],
];

export default function PasswordResets({ token }) {
    const [status, setStatus] = useState('PENDING');
    const [data, setData] = useState({ items: [], stats: {} });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [codeModal, setCodeModal] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [busy, setBusy] = useState(false);

    const reload = async () => {
        setLoading(true);
        setError('');
        try {
            const q = status ? `?status=${status}` : '';
            const r = await api(`/admin/password-resets${q}`, { token });
            setData(r);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, token]);

    const generateCode = async (req) => {
        setBusy(true);
        try {
            const r = await api(`/admin/password-resets/${req.id}/generate-code`, {
                method: 'POST',
                token,
            });
            setCodeModal({
                code: r.code,
                expiresAt: r.expiresAt,
                user: req.user,
            });
            await reload();
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const reject = async () => {
        if (!rejectTarget) return;
        setBusy(true);
        try {
            await api(`/admin/password-resets/${rejectTarget.id}/reject`, {
                method: 'POST',
                token,
            });
            setRejectTarget(null);
            await reload();
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const copyText = (text) => {
        navigator.clipboard?.writeText(text);
    };

    return (
        <div className="space-y-4">
            {/* ─── Статистика ─── */}
            <div className="card p-5">
                <div className="font-bold text-lg mb-1">🔑 Восстановление пароля</div>
                <div className="text-sm text-white/50 mb-4">
                    Пользователи запрашивают сброс пароля. Свяжитесь с ними
                    по телефону и сообщите код.
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="card p-4">
                        <div className="text-2xl font-bold">
                            {data.stats?.pending ?? '—'}
                        </div>
                        <div className="text-xs text-white/50">Ожидают код</div>
                    </div>
                    <div className="card p-4">
                        <div className="text-2xl font-bold text-violet-soft">
                            {data.stats?.issued ?? '—'}
                        </div>
                        <div className="text-xs text-white/50">Активные коды</div>
                    </div>
                    <div className="card p-4">
                        <div className="text-2xl font-bold">
                            {data.stats?.today ?? '—'}
                        </div>
                        <div className="text-xs text-white/50">За 24 часа</div>
                    </div>
                </div>
            </div>

            {/* ─── Фильтры ─── */}
            <div className="card p-4 flex flex-wrap gap-2">
                {FILTERS.map(([v, l]) => (
                    <button
                        key={v || 'all'}
                        onClick={() => setStatus(v)}
                        className={`chip ${
                            status === v
                                ? 'bg-violet text-white'
                                : 'bg-white/5 text-white/60'
                        }`}
                    >
                        {l}
                    </button>
                ))}
                <button
                    onClick={reload}
                    disabled={loading}
                    className="btn-ghost !py-2 text-sm ml-auto"
                >
                    {loading ? '⏳' : '🔄 Обновить'}
                </button>
            </div>

            {error && (
                <div className="card p-4 text-pink bg-pink/10">{error}</div>
            )}

            {/* ─── Список заявок ─── */}
            <div className="card divide-y divide-white/5">
                {data.items.length === 0 && (
                    <div className="p-8 text-center text-white/40">
                        {loading ? 'Загрузка…' : 'Заявок нет'}
                    </div>
                )}
                {data.items.map((r) => (
                    <div key={r.id} className="p-4 flex items-start gap-3 flex-wrap">
                        <Avatar user={r.user} size={40} />
                        <div className="flex-1 min-w-[220px]">
                            <div className="font-semibold">
                                {r.user.fullName}{' '}
                                <span className="text-white/40 font-normal">
                                    @{r.user.username}
                                </span>
                            </div>
                            <div className="text-xs text-white/40 font-mono mt-0.5">
                                {r.user.phone}
                            </div>
                            <div className="text-xs text-white/40 mt-1 flex items-center gap-2 flex-wrap">
                                <span className={`chip text-[10px] ${
                                    r.status === 'PENDING' ? 'bg-orange-500/20 text-orange-300' :
                                        r.status === 'CODE_ISSUED' ? 'bg-violet/20 text-violet-soft' :
                                            r.status === 'COMPLETED' ? 'bg-lime/20 text-lime' :
                                                r.status === 'REJECTED' ? 'bg-pink/20 text-pink' :
                                                    'bg-white/10 text-white/60'
                                }`}>
                                    {STATUS_LABEL[r.status]}
                                </span>
                                <span>
                                    {new Date(r.createdAt).toLocaleString('ru-RU')}
                                </span>
                                {r.codeExpires && r.status === 'CODE_ISSUED' && (
                                    <span>
                                        код до{' '}
                                        {new Date(r.codeExpires).toLocaleTimeString('ru-RU', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                )}
                                {r.attempts > 0 && (
                                    <span className="text-orange-300">
                                        попыток ввода: {r.attempts}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            {(r.status === 'PENDING' || r.status === 'CODE_ISSUED') && (
                                <>
                                    <button
                                        onClick={() => generateCode(r)}
                                        disabled={busy}
                                        className="chip bg-violet/30 hover:bg-violet/50"
                                    >
                                        {r.status === 'CODE_ISSUED'
                                            ? '🔄 Перегенерировать код'
                                            : '🔑 Сгенерировать код'}
                                    </button>
                                    <button
                                        onClick={() => setRejectTarget(r)}
                                        disabled={busy}
                                        className="chip bg-white/5 hover:bg-pink/30"
                                    >
                                        ✕ Отклонить
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── Модалка с кодом ─── */}
            {codeModal && (
                <div
                    className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm grid place-items-center p-4"
                    onClick={() => setCodeModal(null)}
                >
                    <div
                        className="card max-w-md w-full p-5 text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="text-2xl mb-2">🔑</div>
                        <h3 className="text-xl font-bold mb-3">Код для пользователя</h3>

                        <div className="text-sm text-white/60 mb-2">
                            Сообщите этот код пользователю{' '}
                            <b className="text-white">{codeModal.user.fullName}</b>{' '}
                            ({codeModal.user.phone}) — через звонок, SMS или
                            Telegram.
                        </div>

                        <div className="text-sm text-orange-300 mb-4">
                            Код действует до{' '}
                            {new Date(codeModal.expiresAt).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </div>

                        <div
                            className="text-4xl font-mono font-bold tracking-[0.4em] my-5 py-4 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition select-all"
                            onClick={() => copyText(codeModal.code)}
                            title="Нажмите, чтобы скопировать"
                        >
                            {codeModal.code}
                        </div>

                        <div className="text-xs text-white/40 mb-4">
                            Нажмите на код, чтобы скопировать
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => copyText(codeModal.code)}
                                className="btn-ghost"
                            >
                                📋 Скопировать
                            </button>
                            <button
                                onClick={() => setCodeModal(null)}
                                className="btn-primary"
                            >
                                Понятно
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Подтверждение отклонения ─── */}
            {rejectTarget && (
                <div
                    className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm grid place-items-center p-4"
                    onClick={() => !busy && setRejectTarget(null)}
                >
                    <div
                        className="card max-w-lg w-full p-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="text-2xl mb-2">⚠️</div>
                        <h3 className="text-xl font-bold mb-3">Отклонить заявку?</h3>
                        <p className="text-sm text-white/70 mb-4">
                            Пользователь <b>{rejectTarget.user.fullName}</b> не сможет
                            использовать этот запрос для сброса пароля.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setRejectTarget(null)}
                                disabled={busy}
                                className="btn-ghost"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={reject}
                                disabled={busy}
                                className="btn-primary !bg-pink"
                            >
                                {busy ? '…' : 'Отклонить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}