import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
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

    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Какой урок открыт (порядок = 1..N)
    const lessonParam = Number(searchParams.get('lesson') || 1);
    // Режим просмотра: lesson | test | result
    const mode = searchParams.get('mode') || 'lesson';

    // Ответы на тест храним локально — при возврате к уроку сбрасываем
    const [testAnswers, setTestAnswers] = useState({});
    const [testResult, setTestResult] = useState(null);

    // ── Загрузка курса ────────────────────────────────────────
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

    // ── Активный урок и его позиция в массиве ────────────────
    const { activeLesson, activeIndex, prevLesson, nextLesson } = useMemo(() => {
        if (!course?.lessons?.length) {
            return { activeLesson: null, activeIndex: -1, prevLesson: null, nextLesson: null };
        }
        let idx = course.lessons.findIndex((l) => l.order === lessonParam);
        if (idx === -1) idx = 0;
        return {
            activeLesson: course.lessons[idx],
            activeIndex: idx,
            prevLesson: idx > 0 ? course.lessons[idx - 1] : null,
            nextLesson: idx < course.lessons.length - 1 ? course.lessons[idx + 1] : null,
        };
    }, [course, lessonParam]);

    // ── Хелперы для навигации по URL ─────────────────────────
    const goLesson = (order, keepMode = false) => {
        setTestAnswers({});
        setTestResult(null);
        const next = new URLSearchParams(searchParams);
        next.set('lesson', String(order));
        if (!keepMode) next.set('mode', 'lesson');
        setSearchParams(next, { replace: false });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const goTest = () => {
        if (!activeLesson) return;
        const next = new URLSearchParams(searchParams);
        next.set('lesson', String(activeLesson.order));
        next.set('mode', 'test');
        setSearchParams(next);
        window.scrollTo({ top: 0 });
    };

    const goResult = (result) => {
        setTestResult(result);
        const next = new URLSearchParams(searchParams);
        next.set('mode', 'result');
        setSearchParams(next);
        window.scrollTo({ top: 0 });
    };

    const backToLesson = () => {
        setTestAnswers({});
        const next = new URLSearchParams(searchParams);
        next.set('mode', 'lesson');
        setSearchParams(next);
        window.scrollTo({ top: 0 });
    };

    // Перезагрузить данные курса с сервера
    const refreshCourse = async () => {
        const fresh = await api(`/courses/${slug}`, { token });
        setCourse(fresh);
        return fresh;
    };

    // ── Loading / error ───────────────────────────────────────
    if (loading) {
        return <div className="p-10 text-center text-white/40">Загрузка…</div>;
    }
    if (error || !course) {
        return (
            <div className="p-10 text-center">
                <div className="text-5xl mb-3">📚</div>
                <div className="text-xl font-bold mb-2">Курс не найден</div>
                <div className="text-white/50 mb-6">{error || 'Такого курса нет'}</div>
                <Link to="/app/courses" className="btn-primary">← К курсам</Link>
            </div>
        );
    }

    // ── Прохождение теста ─────────────────────────────────────
    const submitTest = async () => {
        const res = await api(`/courses/tests/${activeLesson.test.id}/submit`, {
            token,
            method: 'POST',
            body: { answers: testAnswers },
        });
        // Обновим прогресс в курсе
        await refreshCourse();
        goResult(res);
        return res;
    };

    // ── Рендер ────────────────────────────────────────────────
    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            {/* Хлебные крошки */}
            <nav className="flex items-center gap-2 text-sm text-white/50 mb-4 flex-wrap">
                <Link to="/app/courses" className="hover:text-white">📚 Курсы</Link>
                <span className="text-white/30">/</span>
                <span className="text-white/80 font-medium truncate">{course.title}</span>
            </nav>

            {!course.enrolled && (
                <div className="card p-4 mb-6 flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[200px] text-sm text-white/70">
                        Вы ещё не записаны на этот курс. Запишитесь, чтобы отслеживать прогресс и получить сертификат.
                    </div>
                    <EnrollButton
                        course={course}
                        onEnrolled={async () => {
                            const fresh = await api(`/courses/${slug}`, { token });
                            setCourse(fresh);
                        }}
                    />
                </div>
            )}

            <div className="grid lg:grid-cols-[280px_1fr] gap-6">
                {/* ─── Сайдбар со списком уроков ─── */}
                <aside className="lg:sticky lg:top-4 self-start">
                    <div className="card p-4">
                        <div className="text-sm text-white/50 mb-3">
                            Прогресс:{' '}
                            <span className="text-white font-semibold">
                                {course.enrolled?.progress ?? course.progress ?? 0}%
                            </span>
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
                                            <span className="text-emerald-400 text-xs">✓</span>
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

                {/* ─── Основной блок ─── */}
                <main>
                    {mode === 'lesson' && activeLesson && (
                        <LessonPanel
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

                    {/* На всякий случай: если режим есть, а данных нет */}
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
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   ЭКРАН УРОКА
   ═══════════════════════════════════════════════════════════ */
function LessonPanel({
                         lesson,
                         courseSlug,
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
                    {!lesson.unlocked && (
                        <span className="text-amber-300">
                            🔒 {lesson.lockReason || 'Урок закрыт'}
                        </span>
                    )}
                </div>
            </header>

            {/* Видео — только здесь, на экране урока */}
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

            {/* Markdown-контент */}
            <MarkdownView
                text={lesson.content}
                className="text-white/85 text-sm md:text-base mb-6"
            />

            {/* Практическое занятие */}
            {lesson.practical && (
                <PracticalCard practical={lesson.practical} onRefresh={onRefresh} />
            )}

            {/* Домашнее задание */}
            {lesson.homework && (
                <HomeworkCard homework={lesson.homework} onRefresh={onRefresh} />
            )}

            {/* Кнопки */}
            <footer className="mt-8 pt-5 border-t border-white/10 flex flex-wrap gap-3 items-center justify-between">
                <button
                    onClick={onPrev}
                    disabled={!hasPrev}
                    className="btn-ghost text-sm disabled:opacity-30"
                >
                    ← Предыдущий
                </button>

                <div className="flex gap-3 flex-wrap">
                    {/* Кнопка «Пройти тест» — если есть тест и урок открыт */}
                    {canTakeTest && (
                        <button onClick={onStartTest} className="btn-primary">
                            {testPassed ? 'Пройти тест заново' : 'Пройти тест →'}
                        </button>
                    )}

                    {/* Кнопка «Следующий урок» — если тест пройден (или теста нет) */}
                    {hasNext && (!hasTest || testPassed) && (
                        <button onClick={onNext} className="btn-ghost">
                            Следующий урок →
                        </button>
                    )}

                    {/* Если урок закрыт — предупреждение вместо кнопок действия */}
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
                            После отправки вы увидите результат и разбор ошибок.
                            Изменить ответы будет нельзя.
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
   КАРТОЧКА ВОПРОСА (типы: single/multiple/matching/text/order)
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
