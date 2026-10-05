import { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

function StatusBadge({ status }) {
    const map = {
        PENDING: ['bg-amber-500/20 text-amber-200', 'На проверке'],
        APPROVED: ['bg-emerald-500/20 text-emerald-200', 'Принято'],
        REJECTED: ['bg-red-500/20 text-red-200', 'Отклонено'],
    };
    const [cls, label] = map[status] || ['bg-white/10 text-white/60', status];
    return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

export default function PracticalCard({ practical, onRefresh }) {
    const { token } = useAuth();
    const submission = practical.submissions?.[0] || null;
    const status = submission?.status;

    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            await api(`/practicals/${practical.id}/submit`, {
                token,
                method: 'POST',
                body: { note },
            });
            await onRefresh?.();
        } catch (e) {
            setError(e.message || 'Ошибка отправки');
        } finally {
            setBusy(false);
        }
    };

    const canSubmit = !submission || status === 'REJECTED';

    return (
        <div className="mb-6 rounded-xl border border-violet-soft/30 bg-violet-soft/5 p-4">
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-semibold text-violet-soft">
                    🎯 Практическое занятие
                </div>
                {status && <StatusBadge status={status} />}
            </div>

            <div className="font-medium mb-1">{practical.topic}</div>
            <div className="text-sm text-white/70 whitespace-pre-wrap mb-3">
                {practical.description}
            </div>

            {practical.scheduledAt && (
                <div className="text-xs text-white/50 mb-1">
                    🗓 {new Date(practical.scheduledAt).toLocaleString('ru-RU')}
                    {practical.durationMin ? ` · ${practical.durationMin} мин` : ''}
                </div>
            )}
            {practical.supervisor && (
                <div className="text-xs text-white/50 mb-3">
                    Руководитель: {practical.supervisor.fullName || practical.supervisor.username}
                </div>
            )}

            {submission?.feedback && status !== 'PENDING' && (
                <div
                    className={`mt-3 mb-3 rounded-lg p-3 text-sm ${
                        status === 'APPROVED'
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
                            : 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                    }`}
                >
                    <div className="font-medium mb-1">
                        {status === 'APPROVED' ? '✓ Принято' : '↺ Нужно доработать'}
                        {submission.grade != null && ` · Оценка ${submission.grade}/5`}
                    </div>
                    {submission.feedback}
                </div>
            )}

            {canSubmit && (
                <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="text-xs text-white/50 mb-2">
                        Отметьте, что практика пройдена, и при необходимости оставьте комментарий.
                    </div>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Комментарий (необязательно)"
                        className="input w-full text-sm mb-2"
                        rows={2}
                    />
                    <button
                        onClick={submit}
                        disabled={busy}
                        className="btn-primary text-sm disabled:opacity-40"
                    >
                        {busy ? 'Отправка…' : 'Сдать практику на проверку'}
                    </button>
                    {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
                </div>
            )}

            {status === 'PENDING' && (
                <div className="text-xs text-white/50 mt-3">
                    Ожидает проверки руководителем…
                </div>
            )}
        </div>
    );
}