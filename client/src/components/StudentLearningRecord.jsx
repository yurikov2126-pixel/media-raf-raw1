import HomeworkHistory from './HomeworkHistory.jsx';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const statusNames = { PENDING: 'На проверке', APPROVED: 'Принято', REJECTED: 'Доработка' };
const dateLabel = (value) => value ? new Date(value).toLocaleDateString('ru-RU') : '';

function WorkList({ title, items, slug, showHistory = false }) {
    return <section className="space-y-2">
        <h3 className="font-semibold text-lg">{title} <span className="text-white/50 text-sm">({items.length})</span></h3>
        {items.map((item) => <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><div className="font-medium break-words">{item.title}</div>
                    <div className="text-xs text-white/60 mt-1">Урок {item.lessonOrder} · {dateLabel(item.updatedAt)}</div></div>
                <span className={`text-xs rounded-lg px-2 py-1 shrink-0 ${item.status === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-200' : item.status === 'REJECTED' ? 'bg-amber-500/15 text-amber-200' : 'bg-white/10 text-white/80'}`}>
                    {statusNames[item.status] || item.status}
                </span>
            </div>
            {item.grade != null && <div className="text-sm text-white/80">Оценка: <strong>{item.grade}/5</strong></div>}
            {item.feedback && <div className="rounded-lg bg-black/20 p-3 text-sm text-white/80 whitespace-pre-wrap">
                <div className="text-xs text-white/60 mb-1">Комментарий {item.reviewer ? '· ' + item.reviewer : ''}</div>
                {item.feedback}
            </div>}
            {showHistory && <HomeworkHistory submissionId={item.id} />}
            <Link to={`/app/courses/${encodeURIComponent(slug)}?lesson=${item.lessonOrder}`} className="inline-block text-violet-soft text-xs">Открыть урок →</Link>
        </div>)}
        {!items.length && <div className="p-4 text-sm text-white/60 rounded-xl bg-white/5">Работ этого типа пока нет.</div>}
    </section>;
}

export default function StudentLearningRecord({ userId, courseId, onClose }) {
    const { token } = useAuth();
    const [record, setRecord] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        setRecord(null); setError('');
        api(`/mentor-academy/students/${encodeURIComponent(userId)}/courses/${encodeURIComponent(courseId)}`, { token })
            .then((data) => { if (active) setRecord(data); })
            .catch((err) => { if (active) setError(err.message || 'Не удалось загрузить карточку'); });
        return () => { active = false; };
    }, [userId, courseId, token]);
    return <div className="card p-4 md:p-6 space-y-6 border border-violet-soft/30" data-no-route-swipe>
        <div className="flex justify-between items-start gap-3">
            <div className="min-w-0"><h2 className="font-bold text-xl">Учебная карточка студента</h2>
                {record && <div className="text-sm text-white/65 mt-1">{record.student.fullName || record.student.username} · {record.course.title}</div>}</div>
            <button type="button" onClick={onClose} className="btn-ghost min-h-11 shrink-0">✕ Закрыть</button>
        </div>
        {!record && !error && <div role="status" className="text-white/70">Загружаем результаты…</div>}
        {error && <div role="alert" className="p-3 rounded-lg text-red-300 bg-red-500/10">{error}</div>}
        {record && <>
            <div className="rounded-xl bg-white/5 p-4">
                <div className="flex justify-between text-sm mb-2"><span>Прогресс обучения</span><strong>{record.progress}%</strong></div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-violet-soft" style={{ width: record.progress + '%' }} /></div>
                <div className="text-xs text-white/60 mt-2">Пройдено {record.lessons.filter(l => l.completed).length} из {record.lessons.length} уроков</div>
            </div>
            <section className="space-y-2">
                <h3 className="font-semibold text-lg">История уроков</h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                    {record.lessons.map((lesson) => <div key={lesson.id} className="flex gap-3 items-center p-2 rounded-lg bg-white/5 text-sm">
                        <span className="shrink-0">{lesson.completed ? '✅' : '○'}</span>
                        <span className="flex-1 min-w-0 break-words">{lesson.order}. {lesson.title}</span>
                        <span className="text-xs text-white/60 shrink-0">{lesson.completed ? dateLabel(lesson.completedAt) || 'Пройден' : 'Не завершён'}</span>
                    </div>)}
                </div>
            </section>
            <section className="space-y-2">
                <h3 className="font-semibold text-lg">Результаты тестов <span className="text-white/50 text-sm">({record.attempts.length})</span></h3>
                {record.attempts.map((attempt) => <div key={attempt.id} className="rounded-xl p-3 bg-white/5 flex justify-between gap-3">
                    <div className="min-w-0"><div className="text-sm font-medium">{attempt.title}</div>
                        <div className="text-xs text-white/60 mt-1">Урок {attempt.lessonOrder} · {dateLabel(attempt.createdAt)}</div></div>
                    <span className={attempt.passed ? 'text-emerald-300 shrink-0' : 'text-amber-200 shrink-0'}>{attempt.score}%</span>
                </div>)}
                {!record.attempts.length && <p className="text-white/60 text-sm">Попыток тестирования пока нет.</p>}
            </section>
            <WorkList title="Домашние задания" items={record.homework} slug={record.course.slug} showHistory />
            <WorkList title="Практические работы" items={record.practicals} slug={record.course.slug} />
        </>}
    </div>;
}
