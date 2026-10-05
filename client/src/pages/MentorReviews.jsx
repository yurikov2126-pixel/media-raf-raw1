import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

export default function MentorReviews() {
    const { token, user } = useAuth();
    const [tab, setTab] = useState('practicals');
    const [practicals, setPracticals] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [p, h] = await Promise.all([
                api('/practicals/review', { token }),
                api('/homework/review', { token }),
            ]);
            setPracticals(p);
            setHomeworks(h);
        } catch (e) {
            setError(e.message || 'Ошибка загрузки');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.role === 'MENTOR' || user?.role === 'ADMIN') load();
    }, [token, user]);

    if (user?.role !== 'MENTOR' && user?.role !== 'ADMIN') {
        return (
            <div className="p-10 text-center text-white/60">
                Доступ только для руководителей.
            </div>
        );
    }

    const pendingPracticals = practicals.reduce(
        (s, p) => s + (p.submissions?.filter((x) => x.status === 'PENDING').length || 0),
        0
    );

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            <h1 className="text-2xl md:text-3xl font-bold mb-6">🧑‍🏫 Кабинет руководителя</h1>

            <div className="flex gap-2 mb-5 flex-wrap">
                <TabBtn active={tab === 'practicals'} onClick={() => setTab('practicals')}>
                    🎯 Практики ({pendingPracticals})
                </TabBtn>
                <TabBtn active={tab === 'homework'} onClick={() => setTab('homework')}>
                    📋 ДЗ ({homeworks.length})
                </TabBtn>
            </div>

            {loading && <div className="text-white/40 text-center py-10">Загрузка…</div>}
            {error && <div className="text-red-400 text-center py-10">{error}</div>}

            {!loading && tab === 'practicals' && (
                <div className="space-y-4">
                    {practicals.length === 0 && (
                        <div className="text-white/40 text-center py-10">Практик пока нет</div>
                    )}
                    {practicals.map((p) => (
                        <PracticalReviewCard key={p.id} practical={p} onRefresh={load} />
                    ))}
                </div>
            )}

            {!loading && tab === 'homework' && (
                <div className="space-y-4">
                    {homeworks.length === 0 && (
                        <div className="text-white/40 text-center py-10">ДЗ на проверке нет</div>
                    )}
                    {homeworks.map((h) => (
                        <HomeworkReviewCard key={h.id} submission={h} onRefresh={load} />
                    ))}
                </div>
            )}
        </div>
    );
}

function TabBtn({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-xl text-sm transition ${
                active ? 'bg-violet-soft/20 text-white' : 'hover:bg-white/5 text-white/70'
            }`}
        >
            {children}
        </button>
    );
}

function PracticalReviewCard({ practical, onRefresh }) {
    const { token } = useAuth();
    const [busyId, setBusyId] = useState(null);

    const review = async (submissionId, status, feedback, grade) => {
        setBusyId(submissionId);
        try {
            await api(`/practicals/submissions/${submissionId}/review`, {
                token,
                method: 'POST',
                body: { status, feedback, grade },
            });
            await onRefresh();
        } catch (e) {
            alert(e.message);
        } finally {
            setBusyId(null);
        }
    };

    const pending = (practical.submissions || []).filter((s) => s.status === 'PENDING');

    return (
        <div className="card p-5">
            <div className="text-xs text-white/40 mb-1">
                {practical.course?.title} · Урок {practical.lesson?.order}
            </div>
            <div className="font-semibold mb-1">{practical.topic}</div>
            <div className="text-sm text-white/60 whitespace-pre-wrap mb-3">
                {practical.description}
            </div>

            {pending.length === 0 && (
                <div className="text-xs text-white/40">Нет новых сдач</div>
            )}

            {pending.map((s) => (
                <ReviewForm
                    key={s.id}
                    submission={s}
                    busy={busyId === s.id}
                    onSubmit={(status, feedback, grade) =>
                        review(s.id, status, feedback, grade)
                    }
                />
            ))}
        </div>
    );
}

function HomeworkReviewCard({ submission, onRefresh }) {
    const { token } = useAuth();
    const [busy, setBusy] = useState(false);

    const review = async (status, feedback, grade) => {
        setBusy(true);
        try {
            await api(`/homework/submissions/${submission.id}/review`, {
                token,
                method: 'POST',
                body: { status, feedback, grade },
            });
            await onRefresh();
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    let files = [];
    try {
        files = JSON.parse(submission.files || '[]');
    } catch {}

    return (
        <div className="card p-5">
            <div className="text-xs text-white/40 mb-2">
                {submission.homework?.lesson?.course?.title} ·{' '}
                {submission.homework?.title} · {submission.user?.fullName}
            </div>

            {submission.text && (
                <div className="text-sm mb-2 whitespace-pre-wrap">{submission.text}</div>
            )}
            {submission.link && (
                <div className="text-sm mb-2">
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
                <div className="flex flex-wrap gap-2 mb-3">
                    {files.map((f, i) => (
                        <a
                            key={i}
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs hover:border-white/20"
                        >
                            📎 {f.name}
                        </a>
                    ))}
                </div>
            )}

            <ReviewForm submission={submission} busy={busy} onSubmit={review} />
        </div>
    );
}

function ReviewForm({ submission, busy, onSubmit }) {
    const [feedback, setFeedback] = useState('');
    const [grade, setGrade] = useState('');

    return (
        <div className="border-t border-white/10 pt-3 mt-3">
            <div className="text-xs text-white/50 mb-2">
                Студент: {submission.user?.fullName || submission.user?.username}
            </div>
            <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Комментарий для студента"
                className="input w-full text-sm mb-2"
                rows={2}
            />
            <div className="flex items-center gap-2 flex-wrap">
                <input
                    type="number"
                    min={1}
                    max={5}
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="Оценка 1–5"
                    className="input w-32 text-sm"
                />
                <button
                    disabled={busy}
                    onClick={() =>
                        onSubmit('APPROVED', feedback, grade ? Number(grade) : null)
                    }
                    className="btn-primary text-sm disabled:opacity-40"
                >
                    ✓ Принять
                </button>
                <button
                    disabled={busy}
                    onClick={() => onSubmit('REJECTED', feedback, null)}
                    className="btn-ghost text-sm disabled:opacity-40"
                >
                    ↺ На доработку
                </button>
            </div>
        </div>
    );
}