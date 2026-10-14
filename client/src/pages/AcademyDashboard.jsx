import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import usePageMeta from '../hooks/usePageMeta.js';
import MarkdownView from '../components/MarkdownView.jsx';

const destination = (slug, order, mode = 'lesson') =>
    `/app/courses/${encodeURIComponent(slug)}${order ? `?lesson=${order}&mode=${mode}` : ''}`;
const labels = {
    NOT_SUBMITTED: ['Не сдано', 'bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-white/75'],
    PENDING: ['На проверке', 'bg-amber-500/15 text-amber-800 dark:text-amber-200'],
    REJECTED: ['Нужна доработка', 'bg-red-500/15 text-red-800 dark:text-red-200'],
    APPROVED: ['Принято', 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'],
};
const sections = [
    ['courses', 'Мои курсы'],
    ['assignments', 'Домашние задания'],
    ['practicals', 'Практики'],
    ['results', 'Результаты'],
    ['certificates', 'Достижения'],
];
export default function AcademyDashboard() {
    const { token } = useAuth();
    const [data, setData] = useState(null);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState('');
    const [section, setSection] = useState('courses');
    usePageMeta({ title: 'Моя Академия', description: 'Мои курсы, задания, результаты и сертификаты' });
    useEffect(() => {
        let active = true;
        setBusy(true);
        api('/courses/my-learning', { token })
            .then((value) => { if (active) setData(value); })
            .catch((err) => { if (active) setError(err.message || 'Не удалось загрузить Академию'); })
            .finally(() => { if (active) setBusy(false); });
        return () => { active = false; };
    }, [token]);
    if (busy) return <div className="p-8 text-slate-700 dark:text-white/70" role="status">Загружаем вашу Академию…</div>;
    if (error) return <div className="p-6"><p role="alert" className="text-red-700 dark:text-red-300">{error}</p><Link className="btn-ghost inline-flex mt-4" to="/app/courses">Открыть каталог</Link></div>;
    const courses = data?.courses || [];
    const assignments = data?.assignments || [];
    const practicals = data?.practicals || [];
    const results = data?.results || [];
    const certificates = data?.certificates || [];
    const current = courses.find((course) => !course.completed) || courses[0];
    const average = courses.length ? Math.round(courses.reduce((acc, item) => acc + (item.progress || 0), 0) / courses.length) : 0;
    return <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
        <header>
            <nav className="text-xs text-slate-600 dark:text-white/65 mb-2"><Link to="/app/courses" className="hover:text-violet-800 dark:hover:text-white">Академия</Link> / Мой кабинет</nav>
            <h1 className="text-3xl md:text-4xl font-bold">Моя Академия</h1>
            <p className="text-slate-600 dark:text-white/65 text-sm mt-2">Продолжайте учиться, отслеживайте задания и сохраняйте результаты.</p>
        </header>
        <div className="grid grid-cols-3 gap-2 md:gap-4">
            {[[courses.length, 'Курсов'], [average + '%', 'Прогресс'], [[...assignments, ...practicals].filter((a) => a.status === 'REJECTED' || a.status === 'NOT_SUBMITTED').length, 'Требует внимания']].map(([value, label]) =>
                <div key={label} className="card p-3 md:p-5 text-center"><div className="font-bold text-2xl">{value}</div><div className="text-xs text-slate-600 dark:text-white/65">{label}</div></div>)}
        </div>
        {current && <section className="card p-4 md:p-6 border border-violet-soft/30">
            <div className="text-violet-700 dark:text-violet-soft uppercase tracking-wide text-xs font-semibold mb-2">Продолжить обучение</div>
            <h2 className="font-bold text-xl mb-1">{current.title}</h2>
            <p className="text-slate-600 dark:text-white/65 text-sm mb-3">{current.resumeLessonOrder ? `Урок ${current.resumeLessonOrder}` : 'Открыть курс'}</p>
            <div className="h-2 bg-slate-200/70 dark:bg-white/10 rounded-full overflow-hidden mb-4"><div className="bg-violet-soft h-full" style={{ width: (current.progress || 0) + '%' }} /></div>
            <Link className="btn-primary inline-flex min-h-11 items-center justify-center" to={destination(current.slug, current.resumeLessonOrder)}>▶ Продолжить</Link>
        </section>}
        {[...assignments, ...practicals].some((a) => a.status === 'REJECTED' || a.status === 'NOT_SUBMITTED') && <section className="card p-4 border border-amber-500/20">
            <h2 className="font-bold mb-3">Требует внимания</h2>
            {[...assignments.map(a => ({...a, kind: 'homework'})), ...practicals.map(a => ({...a, kind: 'practical'}))].filter((a) => a.status === 'REJECTED' || a.status === 'NOT_SUBMITTED').slice(0, 3).map((a) =>
                <Link className="block p-3 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 mb-2" key={a.id} to={`${destination(a.slug, a.lessonOrder)}&focus=${a.kind}`}>
                    <div className="font-medium text-sm">{a.kind === 'practical' ? '🎯 ' : '📋 '}{a.title}</div>
                    <div className="text-xs text-amber-800 dark:text-amber-200 mt-1">{a.status === 'REJECTED' ? 'Нужно исправить работу →' : 'Задание ещё не сдано →'}</div>
                </Link>)}
        </section>}
        <nav className="flex gap-2 overflow-x-auto pb-2" aria-label="Разделы личного кабинета">
            {sections.map(([id, name]) => <button key={id} type="button" aria-pressed={section === id} onClick={() => setSection(id)}
                className={`shrink-0 min-h-11 px-4 rounded-xl text-sm font-medium ${section === id ? 'bg-violet text-white' : 'bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-white/75 hover:text-violet-800 dark:hover:text-white'}`}>{name}</button>)}
        </nav>
        {section === 'courses' && <section className="grid sm:grid-cols-2 gap-3">
            {courses.map((c) => <Link key={c.id} to={destination(c.slug, c.resumeLessonOrder)} className="card p-4 hover:border-violet-soft/40">
                <div className="text-xs text-slate-600 dark:text-white/60 mb-2">{c.completed ? '✓ Курс завершён' : 'Обучение продолжается'}</div>
                <h2 className="font-bold mb-3">{c.title}</h2>
                <div className="flex justify-between text-xs text-slate-600 dark:text-white/65 mb-2"><span>{c.totalLessons} уроков</span><span>{c.progress}%</span></div>
                <div className="h-2 bg-slate-200/70 dark:bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-violet-soft" style={{width: c.progress + '%'}} /></div>
                <div className="text-sm text-violet-700 dark:text-violet-soft mt-4">{c.resumeLessonOrder ? `Продолжить с урока ${c.resumeLessonOrder} →` : 'Открыть курс →'}</div>
            </Link>)}
            {!courses.length && <div className="card p-6 text-slate-700 dark:text-white/70">Вы ещё не записались на курсы. <Link to="/app/courses" className="text-violet-700 dark:text-violet-soft">Выбрать курс →</Link></div>}
        </section>}
        {section === 'assignments' && <section className="space-y-3">
            {assignments.map((a) => <Link key={a.id} to={destination(a.slug, a.lessonOrder)} className="card p-4 block hover:border-violet-soft/40">
                <div className="flex items-center justify-between gap-2 mb-2"><span className="font-medium">{a.title}</span><span className={`shrink-0 text-xs px-2 py-1 rounded-full ${labels[a.status]?.[1] || 'bg-slate-200/70 dark:bg-white/10'}`}>{labels[a.status]?.[0] || a.status}</span></div>
                <div className="text-xs text-slate-600 dark:text-white/60">{a.courseTitle}{a.updatedAt ? ' · ' + new Date(a.updatedAt).toLocaleDateString('ru-RU') : ''}</div>
                {a.feedback && <p className="text-sm text-slate-700 dark:text-white/75 mt-2">{a.feedback}</p>}
            </Link>)}
            {!assignments.length && <p className="card p-6 text-slate-600 dark:text-white/65">Домашних заданий пока нет.</p>}
        </section>}
        {section === 'practicals' && <section className="space-y-3" aria-label="Мои практические работы">
            {practicals.map((p) => <Link key={p.id} to={`${destination(p.slug, p.lessonOrder)}&focus=practical`}
                className="card p-4 block hover:border-violet-soft/40">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <span className="font-semibold break-words">🎯 {p.title}</span>
                    <span className={`shrink-0 text-xs px-2 py-1 rounded-full ${labels[p.status]?.[1] || 'bg-slate-200/70 dark:bg-white/10'}`}>{labels[p.status]?.[0] || p.status}</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-white/65">{p.courseTitle} · Урок {p.lessonOrder}</div>
                {p.scheduledAt && <div className="text-xs text-slate-600 dark:text-white/65 mt-2">Дата практики: {new Date(p.scheduledAt).toLocaleString('ru-RU')}</div>}
                {p.location && <div className="text-xs text-slate-600 dark:text-white/65 mt-1">Место: {p.location}</div>}
                {p.description && <MarkdownView text={p.description} className="text-sm text-slate-700 dark:text-white/75 mt-2 break-words line-clamp-4" />}
                {p.feedback && <div className="mt-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-3 text-sm text-slate-800 dark:text-white/85 whitespace-pre-wrap">Комментарий наставника: {p.feedback}</div>}
                {p.grade != null && <div className="text-sm text-violet-700 dark:text-violet-soft mt-2">Оценка: {p.grade}/5</div>}
                <div className="text-sm text-violet-700 dark:text-violet-soft mt-3">Открыть практику →</div>
            </Link>)}
            {!practicals.length && <p className="card p-6 text-slate-600 dark:text-white/65">Практических работ пока нет.</p>}
        </section>}
        {section === 'results' && <section className="space-y-3">
            {results.map((a) => <Link key={a.id} to={destination(a.slug, a.lessonOrder)} className="card block p-4 hover:border-violet-soft/40">
                <div className="flex justify-between gap-3"><h2 className="font-semibold">{a.title}</h2><span className={a.passed ? 'text-emerald-300' : 'text-amber-800 dark:text-amber-200'}>{a.score}%</span></div>
                <div className="text-xs text-slate-600 dark:text-white/60 mt-2">{a.courseTitle} · {new Date(a.createdAt).toLocaleDateString('ru-RU')} · {a.passed ? 'Сдан' : 'Не сдан'}</div>
            </Link>)}
            {!results.length && <p className="card p-6 text-slate-600 dark:text-white/65">Результатов тестирования пока нет.</p>}
        </section>}
        {section === 'certificates' && <section className="grid sm:grid-cols-2 gap-3">
            {certificates.map((c) => <Link key={c.id} to={`/app/certificates/${c.id}`} className="card block p-5 hover:border-violet-soft/40">
                <div className="text-2xl mb-2">🏆</div><h2 className="font-semibold">{c.title}</h2>
                <p className="text-xs text-slate-600 dark:text-white/60 mt-2">Выдан {new Date(c.issuedAt).toLocaleDateString('ru-RU')} · Открыть →</p>
            </Link>)}
            {!certificates.length && <p className="card p-6 text-slate-600 dark:text-white/65">Сертификаты появятся после завершения курсов.</p>}
        </section>}
    </div>;
}
