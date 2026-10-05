import { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import FileUploader from './FileUploader.jsx';

function StatusBadge({ status }) {
    const map = {
        PENDING: ['bg-amber-500/20 text-amber-200', 'На проверке'],
        APPROVED: ['bg-emerald-500/20 text-emerald-200', 'Принято'],
        REJECTED: ['bg-red-500/20 text-red-200', 'Отклонено'],
    };
    const [cls, label] = map[status] || ['bg-white/10 text-white/60', status];
    return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

export default function HomeworkCard({ homework, onRefresh }) {
    const { token } = useAuth();
    const submission = homework.submissions?.[0] || null;
    const status = submission?.status;

    const [text, setText] = useState(submission?.text || '');
    const [link, setLink] = useState(submission?.link || '');
    const [files, setFiles] = useState(() => {
        try {
            return submission?.files ? JSON.parse(submission.files) : [];
        } catch {
            return [];
        }
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const editable = !submission || status === 'REJECTED';

    const submit = async () => {
        if (!text.trim() && !link.trim() && files.length === 0) {
            setError('Нужно сдать хотя бы что-то: текст, ссылку или файл');
            return;
        }
        setBusy(true);
        setError('');
        try {
            await api(`/homework/${homework.id}/submit`, {
                token,
                method: 'POST',
                body: { text, link, files },
            });
            await onRefresh?.();
        } catch (e) {
            setError(e.message || 'Ошибка отправки');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mb-6 rounded-xl border border-cyan-soft/30 bg-cyan-soft/5 p-4">
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-semibold text-cyan-soft">
                    📋 Домашнее задание
                </div>
                {status && <StatusBadge status={status} />}
            </div>

            <div className="font-medium mb-1">{homework.title}</div>
            <div className="text-sm text-white/70 whitespace-pre-wrap mb-3">
                {homework.description}
            </div>

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

            {submission && status === 'APPROVED' && (
                <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/60 space-y-1">
                    {submission.text && (
                        <div className="whitespace-pre-wrap">Текст: {submission.text}</div>
                    )}
                    {submission.link && (
                        <div>
                            Ссылка:{' '}
                            <a
                                href={submission.link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-violet-soft hover:underline"
                            >
                                {submission.link}
                            </a>
                        </div>
                    )}
                    {files.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                            {files.map((f, i) => (
                                <a
                                    key={i}
                                    href={f.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-white/20"
                                >
                                    📎 {f.name}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {editable && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Текстовый ответ"
                        className="input w-full text-sm"
                        rows={4}
                    />
                    <input
                        type="url"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="Ссылка (Google Drive, YouTube, Behance…)"
                        className="input w-full text-sm"
                    />
                    <FileUploader
                        files={files}
                        onChange={setFiles}
                        maxFiles={homework.maxFiles || 3}
                        maxSizeMb={homework.maxFileSizeMb || 50}
                    />
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={submit}
                            disabled={busy}
                            className="btn-primary text-sm disabled:opacity-40"
                        >
                            {busy ? 'Отправка…' : submission ? 'Отправить повторно' : 'Сдать ДЗ'}
                        </button>
                        {error && <span className="text-xs text-red-400">{error}</span>}
                    </div>
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