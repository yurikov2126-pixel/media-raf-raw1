import { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const REASONS = [
    { v: 'spam', l: '📢 Спам' },
    { v: 'abuse', l: '⚠️ Оскорбления' },
    { v: 'illegal', l: '🚫 Противозаконное' },
    { v: 'other', l: '❓ Другое' },
];

export default function ReportButton({
                                         targetType,
                                         targetId,
                                         className,
                                         label = 'Пожаловаться',
                                         iconOnly,
                                         // Внешнее управление (опционально)
                                         externalOpen,
                                         onExternalClose,
                                     }) {
    const { token } = useAuth();
    const [internalOpen, setInternalOpen] = useState(false);
    const open = externalOpen !== undefined ? externalOpen : internalOpen;

    const [reason, setReason] = useState('spam');
    const [comment, setComment] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');

    const close = () => {
        if (busy) return;
        setInternalOpen(false);
        onExternalClose?.();
        setTimeout(() => {
            setDone(false);
            setError('');
            setComment('');
            setReason('spam');
        }, 200);
    };

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            await api('/reports', {
                method: 'POST',
                token,
                body: { targetType, targetId, reason, comment },
            });
            setDone(true);
            setTimeout(close, 1500);
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const modal = open
        ? createPortal(
            <div
                className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm grid place-items-center p-4"
                onClick={close}
            >
                <div className="card max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
                    {done ? (
                        <div className="text-center py-6">
                            <div className="text-5xl mb-3">✅</div>
                            <div className="font-bold text-lg">Жалоба отправлена</div>
                            <div className="text-sm text-white/50 mt-1">
                                Администрация рассмотрит её в ближайшее время.
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <div className="font-bold text-lg">🚩 Пожаловаться</div>
                                <button
                                    onClick={close}
                                    className="w-8 h-8 grid place-items-center rounded-full text-white/40 hover:text-white hover:bg-white/10"
                                    aria-label="Закрыть"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
                                Причина
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {REASONS.map((r) => (
                                    <button
                                        key={r.v}
                                        type="button"
                                        onClick={() => setReason(r.v)}
                                        className={`chip justify-center ${
                                            reason === r.v
                                                ? 'bg-violet text-white'
                                                : 'bg-white/5 text-white/60'
                                        }`}
                                    >
                                        {r.l}
                                    </button>
                                ))}
                            </div>

                            <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
                                Комментарий (необязательно)
                            </div>
                            <textarea
                                rows={3}
                                className="input resize-none mb-4"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Опишите, что не так…"
                                maxLength={500}
                            />

                            {error && (
                                <div className="text-sm text-pink bg-pink/10 rounded-xl p-3 mb-3">
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-end gap-2">
                                <button onClick={close} disabled={busy} className="btn-ghost">
                                    Отмена
                                </button>
                                <button onClick={submit} disabled={busy} className="btn-primary">
                                    {busy ? 'Отправка…' : 'Отправить'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>,
            document.body
        )
        : null;

    // Режим «только модалка» — без кнопки, управляется снаружи
    if (externalOpen !== undefined) {
        return modal;
    }

    return (
        <>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setInternalOpen(true);
                }}
                className={className || 'chip bg-white/5 hover:bg-pink/30 text-xs'}
                title="Пожаловаться"
            >
                🚩{!iconOnly && ` ${label}`}
            </button>
            {modal}
        </>
    );
}