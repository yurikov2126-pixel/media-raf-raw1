import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import WikiContextLink from '../components/WikiContextLink.jsx';
import { useAuth } from '../store/auth.jsx';
import usePageMeta from '../hooks/usePageMeta.js';
import MarkdownView from '../components/MarkdownView.jsx';
import EnrollButton from '../components/EnrollButton.jsx';
import PracticalCard from '../components/PracticalCard.jsx';
import HomeworkCard from '../components/HomeworkCard.jsx';

export default function CourseView() {
    const { slug } = useParams();
    const { token } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const lessonContentRef = useRef(null);
    const [curriculumOpen, setCurriculumOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const lessonParam = Number(searchParams.get('lesson') || 1);
    const mode = searchParams.get('mode') || 'lesson';

    const [testAnswers, setTestAnswers] = useState({});
    const [testResult, setTestResult] = useState(null);

    useEffect(() => {
        setLoading(true);
        api(`/courses/${slug}`, { token })
            .then(setCourse)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
        window.scrollTo({ top: 0 });
    }, [slug, token]);

    usePageMeta({
        title: course ? `${course.title} — MEDIA·RAF·RAW` : 'Курс',
        description: course?.description,
        image: course?.cover,
    });

    const isEnrolled = !!course?.enrolled;

    const { activeLesson, prevLesson, nextLesson } = useMemo(() => {
        if (!isEnrolled) return { activeLesson: null, prevLesson: null, nextLesson: null };
        if (!course?.lessons?.length) {
            return { activeLesson: null, prevLesson: null, nextLesson: null };
        }
        let idx = course.lessons.findIndex((l) => l.order === lessonParam);
        if (idx === -1) idx = 0;
        return {
            activeLesson: course.lessons[idx],
            prevLesson: idx > 0 ? course.lessons[idx - 1] : null,
            nextLesson: idx < course.lessons.length - 1 ? course.lessons[idx + 1] : null,
        };
    }, [course, lessonParam, isEnrolled]);

    // Если доступ к сохранённому уроку изменился, возвращаемся к доступному.
    useEffect(() => {
        if (!isEnrolled || !activeLesson || activeLesson.unlocked || !course?.resumeLessonOrder) return;
        if (activeLesson.order === course.resumeLessonOrder) return;
        const next = new URLSearchParams(searchParams);
        next.set('lesson', String(course.resumeLessonOrder));
        next.set('mode', 'lesson');
        setSearchParams(next, { replace: true });
    }, [isEnrolled, activeLesson?.id, activeLesson?.unlocked, activeLesson?.order, course?.resumeLessonOrder, searchParams, setSearchParams]);

    // На мобильном список уроков расположен над содержимым.
    // Прокручиваем к самому уроку только после выбора или открытия прямой ссылки.
    useEffect(() => {
        if (!isEnrolled || !activeLesson || (!searchParams.has('lesson') && mode === 'lesson')) return;
        const frame = window.requestAnimationFrame(() => {
            lessonContentRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [isEnrolled, activeLesson?.id, lessonParam, mode]);

    // Если не записан, а в URL стоит ?mode=test или ?mode=result — сбрасываем
    useEffect(() => {
        if (!isEnrolled && mode !== 'lesson') {
            const next = new URLSearchParams(searchParams);
            next.set('mode', 'lesson');
            next.delete('lesson');
            setSearchParams(next, { replace: true });
        }
    }, [isEnrolled, mode, searchParams, setSearchParams]);

    const goLesson = (order, keepMode = false) => {
        if (!isEnrolled) return;
        setTestAnswers({});
        setTestResult(null);
        const next = new URLSearchParams(searchParams);
        next.set('lesson', String(order));
        if (!keepMode) next.set('mode', 'lesson');
        setSearchParams(next, { replace: false });
        setCurriculumOpen(false);
    };

    // Ссылка без урока возвращает к сохранённой точке, а не к первому занятию.
    useEffect(() => {
        if (!isEnrolled || !course?.resumeLessonOrder || searchParams.has('lesson')) return;
        const next = new URLSearchParams(searchParams);
        next.set('lesson', String(course.resumeLessonOrder));
        setSearchParams(next, { replace: true });
    }, [isEnrolled, course?.resumeLessonOrder, searchParams, setSearchParams]);

    // Сохраняем посещённый доступный урок на сервере для продолжения с другого устройства.
    useEffect(() => {
        if (!isEnrolled || !activeLesson?.unlocked || mode !== 'lesson' || (!searchParams.has('lesson') && course?.resumeLessonOrder)) return;
        api(`/courses/${slug}/resume`, { method: 'POST', token, body: { order: activeLesson.order } })
            .catch((error) => console.warn('[academy] resume was not saved:', error));
    }, [slug, token, isEnrolled, activeLesson?.id, activeLesson?.unlocked, mode, searchParams, course?.resumeLessonOrder]);

    const goTest = () => {
        if (!isEnrolled || !activeLesson) return;
        const next = new URLSearchParams(searchParams);
        next.set('lesson', String(activeLesson.order));
        next.set('mode', 'test');
        setSearchParams(next);
    };

    const goResult = (result) => {
        setTestResult(result);
        const next = new URLSearchParams(searchParams);
        next.set('mode', 'result');
        setSearchParams(next);
    };

    const backToLesson = () => {
        setTestAnswers({});
        const next = new URLSearchParams(searchParams);
        next.set('mode', 'lesson');
        setSearchParams(next);
    };

    const refreshCourse = async () => {
        const fresh = await api(`/courses/${slug}`, { token });
        setCourse(fresh);
        return fresh;
    };

    if (loading) {
        return <div className="p-10 text-center text-white/40">Загрузка…</div>;
    }
    if (error || !course) {
        return (
            <div className="p-10 text-center">
                <div className="text-5xl mb-3">📚</div>
                <div className="text-xl font-bold mb-2">Курс не найден</div>
                <div className="text-white/50 mb-6">{error || 'Такого курса нет'}</div>
                <Link to="/app/courses" className="btn-primary">← В Академию</Link>
            </div>
        );
    }

    const submitTest = async () => {
        try {
            const res = await api(`/courses/tests/${activeLesson.test.id}/submit`, {
                token,
                method: 'POST',
                body: { answers: testAnswers },
            });
            goResult(res);
            refreshCourse().catch((e) => console.error('[course] refresh failed:', e));
            return res;
        } catch (e) {
            console.error('[test] submit error:', e);
            return { error: e?.message || 'Ошибка отправки теста' };
        }
    };

    // Метаданные курса
    const totalLessons = course.lessons?.length || 0;
    const totalPracticals = course.lessons?.filter((l) => l.practical).length || 0;
    const totalHomeworks = course.lessons?.filter((l) => l.homework).length || 0;
    const totalMinutes = course.lessons?.reduce((s, l) => s + (l.duration || 0), 0) || 0;
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const progress = course.enrolled?.progress ?? course.progress ?? 0;
    const completedLessons = course.lessons?.filter((l) => l.fullyCompleted).length || 0;
    const resumeLesson = course.lessons?.find((l) => l.order === course.resumeLessonOrder && l.unlocked) || course.lessons?.find((l) => l.unlocked && !l.fullyCompleted) || course.lessons?.find((l) => l.unlocked);

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {/* Хлебные крошки */}
            <nav className="flex items-center gap-2 text-sm text-white/50 mb-4 flex-wrap">
                <Link to="/app/courses" className="hover:text-white">🎓 Академия</Link>
                <span className="text-white/30">/</span>
                <span className="text-white/80 font-medium truncate">{course.title}</span>
            </nav>

            {isEnrolled && (
                <section className="lg:hidden card p-4 mb-4 border border-violet-soft/20">
                    <div className="text-xs font-semibold text-violet-soft uppercase mb-2">Сейчас изучаете</div>
                    <h2 className="font-bold text-lg mb-3">{course.title}</h2>
                    <div className="flex justify-between text-xs text-white/70 mb-2">
                        <span>{completedLessons} из {totalLessons} уроков</span><span>{progress}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-violet-soft" style={{ width: progress + '%' }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button type="button" className="btn-ghost min-h-11 border border-white/15" onClick={() => setCurriculumOpen(true)}>☰ Содержание</button>
                        <button type="button" className="btn-primary min-h-11 disabled:opacity-40" disabled={!resumeLesson}
                            onClick={() => resumeLesson && goLesson(resumeLesson.order)}>▶ Продолжить</button>
                    </div>
                    <button type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((v) => !v)}
                        className="w-full text-sm text-white/70 py-3">{detailsOpen ? 'Скрыть описание ↑' : 'Подробнее о курсе ↓'}</button>
                </section>
            )}
            {/* ─── Шапка курса ─── */}
            <header className={`card overflow-hidden mb-6 ${isEnrolled && !detailsOpen ? "hidden lg:block" : ""}`}>
                {course.cover && (
                    <div className="relative w-full h-40 md:h-56 bg-black/40 overflow-hidden">
                        <img
                            src={course.cover}
                            alt={course.title}
                            className="w-full h-full object-cover opacity-70"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />
                    </div>
                )}

                <div className="p-5 md:p-7">
                    <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
                        {course.category && (
                            <span className="chip bg-violet/20 text-violet-soft uppercase">
                                {course.category}
                            </span>
                        )}
                        {course.level && (
                            <span className="chip bg-white/10 text-white/70">
                                {course.level === 'beginner' ? 'Для начинающих'
                                    : course.level === 'intermediate' ? 'Средний уровень'
                                        : course.level === 'advanced' ? 'Продвинутый'
                                            : course.level}
                            </span>
                        )}
                        {course.dripMode && (
                            <span className="chip bg-cyan/10 text-cyan-soft">
                                {course.dripMode === 'test' && '🔒 Открытие по тестам'}
                                {course.dripMode === 'test_homework' && '🔒 После теста и ДЗ'}
                                {course.dripMode === 'test_weekly' && `🔒 Не более ${course.weeklyLessonLimit || 3}/нед.`}
                                {course.dripMode === 'schedule' && `🗓 Каждые ${course.dripInterval || 7} дн.`}
                            </span>
                        )}
                    </div>

                    <h1 className="text-3xl md:text-4xl font-bold mb-4">{course.title}</h1>

                    {course.description && (
                        <div className="text-white/80 text-sm md:text-base leading-relaxed mb-5 max-w-3xl">
                            <MarkdownView text={course.description} />
                        </div>
                    )}

                    {/* Метаданные */}
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/60 mb-5">
                        <div className="flex items-center gap-1.5">
                            <span className="text-white/40">📖</span>
                            <span><b className="text-white">{totalLessons}</b> уроков</span>
                        </div>
                        {totalPracticals > 0 && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-white/40">🎯</span>
                                <span><b className="text-white">{totalPracticals}</b> практик</span>
                            </div>
                        )}
                        {totalHomeworks > 0 && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-white/40">📋</span>
                                <span><b className="text-white">{totalHomeworks}</b> заданий</span>
                            </div>
                        )}
                        {totalHours > 0 && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-white/40">⏱</span>
                                <span>≈ <b className="text-white">{totalHours}</b> ч</span>
                            </div>
                        )}
                    </div>

                    {/* Прогресс или кнопка записи */}
                    {course.enrolled ? (
                        <div>
                            <div className="flex items-center justify-between text-xs text-white/60 mb-2">
                                <span>
                                    Прогресс: <b className="text-white">{progress}%</b>
                                    {totalLessons > 0 && (
                                        <span className="text-white/40 ml-2">
                                            ({completedLessons} из {totalLessons})
                                        </span>
                                    )}
                                </span>
                                {progress === 100 && (
                                    <span className="text-lime">✓ Курс завершён</span>
                                )}
                            </div>
                            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                                <div
                                    className="h-full bg-violet-soft transition-all"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center gap-3">
                            <EnrollButton
                                course={course}
                                onEnrolled={async () => {
                                    const fresh = await api(`/courses/${slug}`, { token });
                                    setCourse(fresh);
                                }}
                            />
                            <span className="text-xs text-white/40">
                                Запишитесь, чтобы открыть уроки, отслеживать прогресс и получить сертификат
                            </span>
                        </div>
                    )}

                    {course.certificateTitle && (
                        <div className="mt-4 pt-4 border-t border-white/10 text-xs text-white/50 flex items-start gap-2">
                            <span className="text-lg">🎓</span>
                            <div>
                                <div className="text-white/70 font-medium">По итогам курса</div>
                                <div>{course.certificateTitle}</div>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {isEnrolled && curriculumOpen && (
                <div className="lg:hidden fixed inset-0 z-[90] flex items-end" role="dialog" aria-modal="true" aria-label="Содержание курса">
                    <button type="button" aria-label="Закрыть содержание" onClick={() => setCurriculumOpen(false)} className="absolute inset-0 bg-black/75" />
                    <div className="relative bg-ink-900 border border-white/15 rounded-t-2xl w-full max-h-[85dvh] p-4 flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between mb-3">
                            <div><h2 className="font-bold text-lg">Содержание курса</h2><p className="text-xs text-white/60">{completedLessons} из {totalLessons} пройдено</p></div>
                            <button type="button" onClick={() => setCurriculumOpen(false)} aria-label="Закрыть" className="btn-ghost min-h-11 min-w-11">✕</button>
                        </div>
                        <div className="overflow-y-auto overscroll-contain space-y-2 pb-4">
                            {course.lessons.map((l, index) => (
                                <button key={l.id} type="button" disabled={!l.unlocked} onClick={() => goLesson(l.order)}
                                    aria-current={l.id === activeLesson?.id ? 'step' : undefined} title={!l.unlocked ? l.lockReason : ''}
                                    className={`w-full text-left flex gap-3 items-center rounded-xl p-3 min-h-14 border ${l.id === activeLesson?.id ? 'bg-violet-soft/20 border-violet-soft/50' : 'border-white/10 bg-white/5'} ${!l.unlocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <span className="text-xs text-white/65 w-5 shrink-0">{index + 1}.</span>
                                    <span className="min-w-0 flex-1"><span className="text-sm block font-medium">{l.title}</span>
                                        {!!l.duration && <span className="text-xs text-white/60 block mt-1">{l.duration} мин</span>}</span>
                                    <span aria-hidden="true">{l.fullyCompleted ? '✅' : l.test && l.testAttempt && !l.theoryPassed ? '❌' : l.unlocked ? '→' : '🔒'}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {isEnrolled ? (
                /* ─── Записан: полный интерфейс с уроками ─── */
                <div className="grid lg:grid-cols-[280px_1fr] gap-6">
                    {/* Сайдбар со списком уроков */}
                    <aside className="hidden lg:block lg:sticky lg:top-4 self-start">
                        <div className="card p-4">
                            <div className="text-sm text-white/50 mb-3">
                                Уроки{' '}
                                {totalLessons > 0 && (
                                    <span className="text-white/40">
                                        · {completedLessons}/{totalLessons}
                                    </span>
                                )}
                            </div>
                            <div className="space-y-1">
                                {course.lessons.map((l) => {
                                    const isActive = l.id === activeLesson?.id;
                                    return (
                                        <button
                                            key={l.id}
                                            onClick={() => goLesson(l.order)}
                                            disabled={!l.unlocked}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-start gap-2 ${
                                                isActive
                                                    ? 'bg-violet-soft/20 text-white'
                                                    : 'hover:bg-white/5 text-white/70'
                                            } ${!l.unlocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                                            title={l.unlocked ? '' : l.lockReason}
                                        >
                                            <span className="text-white/40 text-xs mt-0.5 w-5 shrink-0">
                                                {l.order}.
                                            </span>
                                            <span className="flex-1">{l.title}</span>
                                            {l.fullyCompleted && (
                                                <span className="text-emerald-400 text-xs" title="Урок пройден">✓</span>
                                            )}
                                            {!l.fullyCompleted && l.test && l.testAttempt && !l.theoryPassed && (
                                                <span className="text-red-300 text-xs shrink-0" title={`Тест не пройден: ${l.testAttempt.score}%`}>✕</span>
                                            )}
                                            {!l.unlocked && (
                                                <span className="text-white/40 text-xs">🔒</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>

                    {/* Основной блок */}
                    <main ref={lessonContentRef} className="min-w-0 scroll-mt-20" id="academy-lesson-content">
                        <div className="lg:hidden flex items-center justify-between mb-3 gap-3">
                            <span className="text-sm text-white/70">Урок {activeLesson?.order} из {totalLessons}</span>
                            <button type="button" onClick={() => setCurriculumOpen(true)}
                                className="text-sm font-semibold text-violet-soft border border-violet-soft/30 rounded-lg px-3 min-h-11">☰ Все уроки</button>
                        </div>
                        {mode === 'lesson' && activeLesson && (
                            <LessonPanel
                                focus={searchParams.get('focus')}
                                lesson={activeLesson}
                                courseSlug={slug}
                                onStartTest={goTest}
                                onPrev={() => prevLesson && goLesson(prevLesson.order)}
                                onNext={() => nextLesson?.unlocked && goLesson(nextLesson.order)}
                                hasPrev={!!prevLesson}
                                hasNext={!!nextLesson && nextLesson.unlocked}
                                onRefresh={refreshCourse}
                            />
                        )}

                        {mode === 'test' && activeLesson?.test && (
                            <TestRunner
                                lesson={activeLesson}
                                answers={testAnswers}
                                onChange={(qid, value) =>
                                    setTestAnswers((prev) => ({ ...prev, [qid]: value }))
                                }
                                onSubmit={submitTest}
                                onBack={backToLesson}
                            />
                        )}

                        {mode === 'result' && testResult && (
                            <TestResult
                                result={testResult}
                                lesson={activeLesson}
                                onBack={backToLesson}
                                hasNext={!!nextLesson && nextLesson.unlocked}
                                onNext={() => nextLesson && goLesson(nextLesson.order)}
                            />
                        )}

                        {mode === 'test' && !activeLesson?.test && (
                            <div className="card p-6 text-center text-white/60">
                                У этого урока нет теста.{' '}
                                <button onClick={backToLesson} className="text-violet-soft hover:underline">
                                    Вернуться к уроку
                                </button>
                            </div>
                        )}
                        {mode === 'result' && !testResult && (
                            <div className="card p-6 text-center text-white/60">
                                Результат недоступен.{' '}
                                <button onClick={backToLesson} className="text-violet-soft hover:underline">
                                    Вернуться к уроку
                                </button>
                            </div>
                        )}
                    </main>
                </div>
            ) : (
                /* ─── Не записан: teaser со списком тем ─── */
                <div className="card p-5 md:p-7">
                    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                        <div>
                            <div className="text-lg md:text-xl font-bold">Что внутри курса</div>
                            <div className="text-sm text-white/50 mt-1">
                                Уроки откроются после записи на курс
                            </div>
                        </div>
                        <div className="text-xs text-white/40 text-right">
                            <div>{totalLessons} уроков</div>
                            {totalHours > 0 && <div>≈ {totalHours} ч материала</div>}
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2">
                        {course.lessons.map((l) => (
                            <div
                                key={l.id}
                                className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                            >
                                <div className="w-8 h-8 grid place-items-center rounded-full bg-white/10 text-xs font-bold shrink-0 text-white/50">
                                    {l.order}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-white/80 truncate">
                                        {l.title}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5 flex-wrap">
                                        {l.duration > 0 && <span>⏱ {l.duration} мин</span>}
                                        {l.test && <span>📝 тест</span>}
                                        {l.practical && <span>🎯 практика</span>}
                                        {l.homework && <span>📋 ДЗ</span>}
                                    </div>
                                </div>
                                <span className="text-white/25 text-sm shrink-0">🔒</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center gap-4">
                        <EnrollButton
                            course={course}
                            onEnrolled={async () => {
                                const fresh = await api(`/courses/${slug}`, { token });
                                setCourse(fresh);
                            }}
                        />
                        <div className="text-xs text-white/40 flex-1 min-w-[200px]">
                            После записи откроется первый урок, а остальные — по мере прохождения.
                            {course.dripMode === 'test_weekly' && ` Не более ${course.weeklyLessonLimit || 3} уроков в неделю.`}
                            {course.dripMode === 'schedule' && ` Каждые ${course.dripInterval || 7} дней.`}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   ЭКРАН УРОКА
   ═══════════════════════════════════════════════════════════ */
function LessonPanel({
                         lesson,
                         courseSlug,
                         focus,
                         onStartTest,
                         onPrev,
                         onNext,
                         hasPrev,
                         hasNext,
                         onRefresh,
                     }) {
    const canTakeTest = !!lesson.test && lesson.unlocked;
    const testPassed = lesson.theoryPassed;
    const hasTest = !!lesson.test;
    const [section, setSection] = useState(() => (focus === 'homework' && lesson.homework) || (focus === 'practical' && lesson.practical) ? focus : 'material');
    const [readingProgress, setReadingProgress] = useState(0);
    const materialRef = useRef(null);

    useEffect(() => {
        setSection(((focus === 'homework' && lesson.homework) || (focus === 'practical' && lesson.practical)) ? focus : 'material');
        setReadingProgress(0);
    }, [lesson.id, focus]);

    useEffect(() => {
        if (section !== 'material') return;
        let frame = 0;
        const updateProgress = () => {
            if (frame) return;
            frame = window.requestAnimationFrame(() => {
                frame = 0;
                const content = materialRef.current;
                if (!content) return;
                const rect = content.getBoundingClientRect();
                const distance = Math.max(1, rect.height - window.innerHeight * 0.5);
                const viewed = Math.max(0, Math.min(100, Math.round((window.innerHeight * 0.5 - rect.top) / distance * 100)));
                setReadingProgress(viewed);
            });
        };
        updateProgress();
        window.addEventListener('scroll', updateProgress, { passive: true });
        window.addEventListener('resize', updateProgress);
        return () => {
            window.removeEventListener('scroll', updateProgress);
            window.removeEventListener('resize', updateProgress);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, [section, lesson.id]);

    return (
        <article className="card p-5 md:p-7">
            <header className="mb-5 pb-5 border-b border-white/10">
                <div className="text-xs text-white/40 mb-2">Урок {lesson.order}</div>
                <h1 className="text-2xl md:text-3xl font-bold mb-2">{lesson.title}</h1>
                <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
                    {lesson.duration > 0 && <span>⏱ {lesson.duration} мин</span>}
                    {lesson.test && (
                        <span>📝 Тест: {lesson.test.questions?.length ?? 0} вопросов</span>
                    )}
                    {lesson.practical && <span>🎯 Практика</span>}
                    {lesson.homework && <span>📋 ДЗ</span>}
                    {testPassed && <span className="text-emerald-400">✓ Тест пройден</span>}
                    {lesson.test && !testPassed && lesson.testAttempt && (
                        <span className="text-red-300">✕ Тест не пройден · {lesson.testAttempt.score}%</span>
                    )}
                    {!lesson.unlocked && (
                        <span className="text-amber-300">
                            🔒 {lesson.lockReason || 'Урок закрыт'}
                        </span>
                    )}
                </div>
            </header>

            <nav className="flex gap-2 overflow-x-auto pb-2 mb-5 border-b border-white/10" aria-label="Разделы урока">
                {[
                    { key: 'material', title: '📖 Материал' },
                    ...(lesson.practical ? [{ key: 'practical', title: '🎯 Практика' }] : []),
                    ...(lesson.homework ? [{ key: 'homework', title: '📋 Домашнее задание' }] : []),
                ].map((tab) => (
                    <button key={tab.key} type="button" onClick={() => setSection(tab.key)}
                        aria-current={section === tab.key ? 'page' : undefined}
                        className={`shrink-0 min-h-11 px-4 rounded-xl text-sm font-medium border transition ${section === tab.key
                            ? 'bg-violet-soft/20 border-violet-soft/50 text-white'
                            : 'bg-white/5 border-white/10 text-white/70 hover:text-white'}`}>
                        {tab.title}
                    </button>
                ))}
            </nav>
            {section === 'material' && <div ref={materialRef}>
                <div className="flex items-center justify-between gap-3 text-xs text-white/60 mb-3">
                    <span>Прогресс чтения материала</span><span>{readingProgress}%</span>
                </div>
                <div role="progressbar" aria-label="Прогресс чтения" aria-valuemin={0} aria-valuemax={100}
                    aria-valuenow={readingProgress} className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-5">
                    <div className="h-full bg-violet-soft transition-all" style={{width: readingProgress + '%'}} />
                </div>
            {lesson.videoUrl && (
                <div className="mb-6 rounded-xl overflow-hidden aspect-video bg-black">
                    <iframe
                        src={lesson.videoUrl}
                        title={lesson.title}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                </div>
            )}

            <MarkdownView
                text={lesson.content}
                className="text-white/85 text-sm md:text-base mb-6"
            />

            </div>}
            {section === 'practical' && lesson.practical && (
                <section aria-label="Практическая работа">
                    <PracticalCard practical={lesson.practical} onRefresh={onRefresh} />
                </section>
            )}
            {section === 'homework' && lesson.homework && (
                <section aria-label="Домашнее задание">
                    <HomeworkCard homework={lesson.homework} onRefresh={onRefresh} />
                </section>
            )}

            <footer className="mt-8 pt-5 border-t border-white/10 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <button
                    onClick={onPrev}
                    disabled={!hasPrev}
                    className="btn-ghost min-h-11 text-sm disabled:opacity-30"
                >
                    ← Предыдущий
                </button>

                <div className="flex gap-3 flex-col sm:flex-row flex-wrap">
                    {canTakeTest && (
                        <button onClick={onStartTest} className="btn-primary min-h-11">
                            {testPassed ? 'Пройти тест заново' : 'Пройти тест →'}
                        </button>
                    )}

                    {hasNext && (!hasTest || testPassed) && (
                        <button onClick={onNext} className="btn-ghost min-h-11">
                            Следующий урок →
                        </button>
                    )}

                    {!lesson.unlocked && (
                        <div className="text-sm text-amber-300/80">
                            {lesson.lockReason || 'Урок пока закрыт'}
                        </div>
                    )}
                </div>
            </footer>
        </article>
    );
}

/* ═══════════════════════════════════════════════════════════
   ЭКРАН ТЕСТА
   ═══════════════════════════════════════════════════════════ */
function TestRunner({ lesson, answers, onChange, onSubmit, onBack }) {
    const questions = lesson.test.questions || [];
    const [idx, setIdx] = useState(0);
    const [confirming, setConfirming] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const q = questions[idx];

    const currentAnswered =
        q && answers[q.id] !== undefined && answers[q.id] !== '';

    const allAnswered = questions.every((qq) => {
        const a = answers[qq.id];
        if (a === undefined || a === null) return false;
        if (Array.isArray(a) && a.length === 0) return false;
        if (typeof a === 'string' && a.trim() === '') return false;
        return true;
    });

    const next = () => setIdx((i) => Math.min(questions.length - 1, i + 1));
    const prev = () => setIdx((i) => Math.max(0, i - 1));

    const handleSubmit = async () => {
        setSubmitting(true);
        setSubmitError('');
        try {
            const res = await onSubmit();
            if (res?.error) {
                setSubmitError(res.error);
                return;
            }
            setConfirming(false);
        } catch (e) {
            console.error('[test] submit failed:', e);
            setSubmitError(e?.message || 'Не удалось отправить тест');
        } finally {
            setSubmitting(false);
        }
    };

    if (!q) {
        return (
            <div className="card p-6 text-center text-white/60">
                Вопросы не загружены.{' '}
                <button onClick={onBack} className="text-violet-soft hover:underline">
                    Вернуться к уроку
                </button>
            </div>
        );
    }

    return (
        <div className="card p-5 md:p-7">
            <header className="mb-6 pb-4 border-b border-white/10">
                <div className="text-xs text-white/40 mb-1">
                    Урок {lesson.order} · Тестирование
                </div>
                <h2 className="text-xl md:text-2xl font-bold">{lesson.test.title}</h2>
                <div className="mt-3 flex items-center gap-3 text-xs text-white/50">
                    <span>
                        Вопрос {idx + 1} из {questions.length}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-full bg-violet-soft transition-all"
                            style={{
                                width: `${((idx + 1) / questions.length) * 100}%`,
                            }}
                        />
                    </div>
                </div>
            </header>

            <QuestionCard
                question={q}
                value={answers[q.id]}
                onChange={(v) => onChange(q.id, v)}
            />

            <footer className="mt-8 pt-5 border-t border-white/10 flex flex-wrap gap-3 items-center justify-between">
                <button
                    onClick={onBack}
                    disabled={submitting}
                    className="btn-ghost text-sm disabled:opacity-40"
                >
                    ← К уроку
                </button>

                <div className="flex gap-3">
                    <button
                        onClick={prev}
                        disabled={idx === 0 || submitting}
                        className="btn-ghost text-sm disabled:opacity-30"
                    >
                        Назад
                    </button>

                    {idx < questions.length - 1 ? (
                        <button
                            onClick={next}
                            disabled={!currentAnswered || submitting}
                            className="btn-primary disabled:opacity-30"
                        >
                            Далее →
                        </button>
                    ) : (
                        <button
                            onClick={() => setConfirming(true)}
                            disabled={!allAnswered || submitting}
                            className="btn-primary disabled:opacity-30"
                        >
                            Завершить тест
                        </button>
                    )}
                </div>
            </footer>

            {confirming && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="card p-6 max-w-sm w-full">
                        <h3 className="text-lg font-bold mb-2">Завершить тест?</h3>
                        <p className="text-sm text-white/60 mb-5">
                            После отправки вы увидите результат и разбор ошибок. Изменить
                            ответы будет нельзя.
                        </p>

                        {submitError && (
                            <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                {submitError}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirming(false)}
                                className="btn-ghost flex-1"
                                disabled={submitting}
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="btn-primary flex-1"
                                disabled={submitting}
                            >
                                {submitting ? 'Отправка…' : 'Отправить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   КАРТОЧКА ВОПРОСА
   ═══════════════════════════════════════════════════════════ */
function QuestionCard({ question, value, onChange }) {
    const p = useMemo(() => {
        try {
            return JSON.parse(question.payload || '{}');
        } catch {
            return {};
        }
    }, [question.payload]);

    return (
        <div>
            <div className="text-base md:text-lg font-medium mb-4">{question.text}</div>

            {question.type === 'single' && (
                <div className="space-y-2">
                    {(p.options || []).map((opt, i) => (
                        <label
                            key={i}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                                value === i
                                    ? 'border-violet-soft bg-violet-soft/10'
                                    : 'border-white/10 hover:border-white/20'
                            }`}
                        >
                            <input
                                type="radio"
                                checked={value === i}
                                onChange={() => onChange(i)}
                                className="accent-violet-soft"
                            />
                            <span>{opt}</span>
                        </label>
                    ))}
                </div>
            )}

            {question.type === 'multiple' && (
                <div className="space-y-2">
                    {(p.options || []).map((opt, i) => {
                        const arr = Array.isArray(value) ? value : [];
                        const checked = arr.includes(i);
                        return (
                            <label
                                key={i}
                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                                    checked
                                        ? 'border-violet-soft bg-violet-soft/10'
                                        : 'border-white/10 hover:border-white/20'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                        const next = checked
                                            ? arr.filter((x) => x !== i)
                                            : [...arr, i];
                                        onChange(next);
                                    }}
                                    className="accent-violet-soft"
                                />
                                <span>{opt}</span>
                            </label>
                        );
                    })}
                </div>
            )}

            {question.type === 'text' && (
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Введите ответ"
                    className="input w-full"
                />
            )}

            {question.type === 'matching' && (
                <div className="space-y-3">
                    {(p.left || []).map((left, leftIdx) => {
                        const current = (value && value[leftIdx]) ?? '';
                        return (
                            <div key={leftIdx} className="flex items-center gap-3">
                                <div className="flex-1 text-sm">{left}</div>
                                <select
                                    value={current}
                                    onChange={(e) =>
                                        onChange({
                                            ...(value || {}),
                                            [leftIdx]: Number(e.target.value),
                                        })
                                    }
                                    className="input w-40"
                                >
                                    <option value="">— выбрать —</option>
                                    {(p.right || []).map((r, ri) => (
                                        <option key={ri} value={ri}>
                                            {r}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        );
                    })}
                    {(!p.left || !p.left.length) && (
                        <div className="text-sm text-white/50">
                            Вопрос этого типа пока не настроен.
                        </div>
                    )}
                </div>
            )}

            {question.type === 'order' && (
                <div className="space-y-2 text-sm text-white/60">
                    <div>Упорядочьте элементы (перетаскиванием или стрелками).</div>
                    <div>Этот тип пока можно пропустить — оставлен для совместимости.</div>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   ЭКРАН РЕЗУЛЬТАТА
   ═══════════════════════════════════════════════════════════ */
function TestResult({ result, lesson, onBack, onNext, hasNext }) {
    const passed = result.passed;
    return (
        <div className="card p-5 md:p-7">
            <header className="text-center mb-8">
                <div className="text-6xl mb-3">{passed ? '✅' : '❌'}</div>
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                    {passed ? 'Тест пройден!' : 'Тест не пройден'}
                </h2>
                <div className="text-white/60">
                    Результат:{' '}
                    <span className="text-white font-semibold">{result.score}%</span>{' '}
                    ({result.totalQuestions} вопросов)
                </div>
                {!passed && (
                    <div className="text-sm text-white/40 mt-2">
                        Порог прохождения — обычно 70%. Попробуйте ещё раз, разобрав
                        ошибки ниже.
                    </div>
                )}
            </header>

            {result.wrongQuestions?.length > 0 && (
                <div className="mb-8">
                    <div className="text-lg font-bold mb-3">🔍 Разбор ошибок</div>
                    <div className="space-y-4">
                        {result.wrongQuestions.map((wq, i) => (
                            <div
                                key={i}
                                className="border border-white/10 rounded-xl p-4"
                            >
                                <div className="font-medium mb-2">{wq.text}</div>
                                <div className="text-sm text-white/60">
                                    Набрано: {wq.gained} из {wq.max}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3 justify-center">
                <button onClick={onBack} className="btn-ghost">
                    ← Вернуться к уроку
                </button>
                {passed && hasNext && (
                    <button onClick={onNext} className="btn-primary">
                        Следующий урок →
                    </button>
                )}
            </div>
        </div>
    );
}