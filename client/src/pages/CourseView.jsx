import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import { Sticker } from '../stickers/pack.jsx';
import usePageMeta from '../hooks/usePageMeta.js';

function getEmbedUrl(url) {
    if (!url) return null;
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vk = url.match(/vk\.com\/video(-?\d+_\d+)/);
    if (vk) {
        const [oid, id] = vk[1].split('_');
        return `https://vk.com/video_ext.php?oid=${oid}&id=${id}&hd=2`;
    }
    return null;
}

export default function CourseView() {
    const { slug } = useParams();
    const { token } = useAuth();

    const [course, setCourse] = useState(null);
    const [activeLesson, setActiveLesson] = useState(null);
    const [testResult, setTestResult] = useState(null);
    const [answers, setAnswers] = useState({});
    const [mobileView, setMobileView] = useState('list');
    const topRef = useRef(null);

    const load = () =>
        api(`/courses/${slug}`, { token }).then((c) => {
            setCourse(c);
            const isDesktop =
                typeof window !== 'undefined' &&
                window.matchMedia('(min-width: 768px)').matches;
            if (isDesktop && c.lessons[0] && !activeLesson) {
                setActiveLesson(c.lessons[0]);
            }
        });

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug, token]);

    useEffect(() => {
        if (mobileView === 'lesson') {
            topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [mobileView, activeLesson?.id]);

    usePageMeta({
        title: course ? `🎓 ${course.title}` : 'Курс',
        description: course?.description || 'Курс медиацентра MEDIA·RAF·RAW',
        image: course?.cover,
        type: 'article',
    });

    if (!course) {
        return <div className="p-10 text-center text-white/40">Загрузка…</div>;
    }

    const enroll = async () => {
        await api(`/courses/${course.id}/enroll`, { method: 'POST', token });
        load();
    };

    const complete = async () => {
        try {
            const r = await api(`/courses/lessons/${activeLesson.id}/complete`, {
                method: 'POST',
                token,
            });
            await load();
            if (r.certificate) {
                setCourse((c) => ({ ...c, certificate: r.certificate }));
            }
        } catch (e) {
            alert(e.message);
        }
    };

    const submitTest = async (testId) => {
        try {
            const r = await api(`/courses/tests/${testId}/submit`, {
                method: 'POST',
                token,
                body: { answers },
            });
            setTestResult(r);
            await load();
            if (r.certificate) {
                setCourse((c) => ({ ...c, certificate: r.certificate }));
            }
        } catch (e) {
            alert(e.message);
        }
    };

    const openLesson = (l) => {
        if (!l.unlocked) {
            alert(l.lockReason || 'Урок пока недоступен');
            return;
        }
        setActiveLesson(l);
        setTestResult(null);
        setAnswers({});
        setMobileView('lesson');
    };

    const backToList = () => setMobileView('list');

    const isDone = (id) => course.progress?.some((p) => p.lessonId === id && p.completed);
    const doneCount = course.progress?.filter((p) => p.completed).length || 0;
    const progressPct = course.lessons.length
        ? Math.round((doneCount / course.lessons.length) * 100)
        : 0;

    const embedUrl = activeLesson ? getEmbedUrl(activeLesson.videoUrl) : null;
    const nextLesson = activeLesson
        ? course.lessons[course.lessons.findIndex((l) => l.id === activeLesson.id) + 1]
        : null;
    const mobileInLesson = mobileView === 'lesson' && activeLesson;

    return (
        <div ref={topRef} className="p-4 md:p-10 max-w-6xl mx-auto">
            <div className={mobileInLesson ? 'hidden md:block' : ''}>
                <div
                    className="card p-5 md:p-6 mb-5 md:mb-6"
                    style={{ background: 'linear-gradient(135deg, #7C3AED20 0%, #EC489920 100%)' }}
                >
                    <h1 className="text-2xl md:text-4xl font-bold mb-2">{course.title}</h1>
                    <p className="text-white/70 mb-4 max-w-2xl text-sm md:text-base">
                        {course.description}
                    </p>

                    {course.dripMode && (
                        <div className="chip bg-violet/20 text-violet-soft mb-3">
                            {course.dripMode === 'test'
                                ? '🔒 Доступ по тестам'
                                : course.dripMode === 'schedule'
                                    ? `🗓 Открытие каждые ${course.dripInterval || 7} дн.`
                                    : ''}
                        </div>
                    )}

                    {!course.enrolled ? (
                        <button onClick={enroll} className="btn-primary">
                            Записаться на курс
                        </button>
                    ) : (
                        <div className="flex items-center gap-3 max-w-md">
                            <div className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                    className="h-full"
                                    style={{ width: `${progressPct}%`, background: 'var(--brand-gradient)' }}
                                />
                            </div>
                            <span className="font-bold text-sm">
                {doneCount}/{course.lessons.length}
              </span>
                        </div>
                    )}
                </div>

                {course.certificate && (
                    <div
                        className="card p-4 md:p-5 mb-5 md:mb-6 flex items-center gap-3 md:gap-4"
                        style={{ background: 'linear-gradient(135deg, #84CC1630 0%, #06B6D430 100%)' }}
                    >
                        <div className="text-3xl md:text-4xl">🏆</div>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-base md:text-lg">
                                Курс пройден! Сертификат готов.
                            </div>
                            <div className="text-xs md:text-sm text-white/60 truncate">
                                № {course.certificate.serial}
                            </div>
                        </div>
                        <Link
                            to={`/app/certificates/${course.certificate.id}`}
                            className="btn-primary !py-2 shrink-0"
                        >
                            Открыть
                        </Link>
                    </div>
                )}
            </div>

            <div className="grid md:grid-cols-3 gap-5 md:gap-6">
                <aside
                    className={`${
                        mobileInLesson ? 'hidden md:block' : 'block'
                    } md:col-span-1 space-y-2`}
                >
                    <div className="md:hidden flex items-center justify-between mb-3">
                        <div>
                            <div className="text-lg font-bold">Уроки курса</div>
                            <div className="text-xs text-white/40">
                                {course.enrolled
                                    ? `Пройдено ${doneCount} из ${course.lessons.length}`
                                    : 'Запишитесь, чтобы начать'}
                            </div>
                        </div>
                        {course.enrolled && (
                            <div className="text-2xl font-bold">{progressPct}%</div>
                        )}
                    </div>

                    {course.lessons.map((l, i) => {
                        const done = isDone(l.id);
                        const locked = !l.unlocked;
                        return (
                            <button
                                key={l.id}
                                onClick={() => openLesson(l)}
                                className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition ${
                                    activeLesson?.id === l.id && mobileInLesson
                                        ? 'bg-white/10'
                                        : locked
                                            ? 'opacity-60 cursor-not-allowed'
                                            : 'hover:bg-white/5'
                                }`}
                            >
                                <div
                                    className={`w-9 h-9 shrink-0 grid place-items-center rounded-full text-sm font-bold ${
                                        done
                                            ? 'bg-lime text-black'
                                            : locked
                                                ? 'bg-white/5 text-white/40'
                                                : 'bg-white/10'
                                    }`}
                                >
                                    {done ? '✓' : locked ? '🔒' : i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold truncate text-sm md:text-base">
                                        {l.title}
                                    </div>
                                    <div className="text-xs text-white/40 truncate">
                                        {l.duration} мин
                                        {l.test ? ` · тест (${l.test.questions?.length || 0})` : ''}
                                        {locked && l.lockReason && (
                                            <span className="text-orange-300 ml-2">{l.lockReason}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="md:hidden text-white/30">
                                    {locked ? '🔒' : '›'}
                                </div>
                            </button>
                        );
                    })}

                    {course.lessons.length === 0 && (
                        <div className="card p-6 text-center text-white/40 text-sm">
                            В курсе пока нет уроков
                        </div>
                    )}
                </aside>

                <main
                    className={`${mobileInLesson ? 'block' : 'hidden md:block'} md:col-span-2`}
                >
                    {activeLesson && course.enrolled ? (
                        <article className="card p-4 md:p-6">
                            <div className="md:hidden flex items-center gap-3 mb-4 -mx-1">
                                <button
                                    onClick={backToList}
                                    className="btn-ghost !p-2 shrink-0"
                                    aria-label="Назад к урокам"
                                >
                                    ←
                                </button>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] uppercase tracking-wider text-white/40">
                                        Урок{' '}
                                        {course.lessons.findIndex((l) => l.id === activeLesson.id) + 1}{' '}
                                        из {course.lessons.length}
                                    </div>
                                    <div className="font-semibold truncate text-sm">
                                        {course.title}
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-violet-soft shrink-0">
                                    {progressPct}%
                                </div>
                            </div>

                            <h2 className="text-xl md:text-2xl font-bold mb-4">
                                {activeLesson.title}
                            </h2>

                            {embedUrl ? (
                                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black mb-4">
                                    <iframe
                                        src={embedUrl}
                                        title={activeLesson.title}
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                            ) : activeLesson.videoUrl ? (
                                <video
                                    src={activeLesson.videoUrl}
                                    controls
                                    className="w-full rounded-2xl mb-4 bg-black"
                                />
                            ) : null}

                            <div className="whitespace-pre-wrap text-white/85 text-sm md:text-base leading-relaxed mb-6">
                                {activeLesson.content}
                            </div>

                            {/* Кнопки урока */}
                            <div className="flex flex-wrap gap-2 mb-2">
                                {/*
                  Кнопка «Отметить пройденным» показывается ТОЛЬКО если:
                  - урок ещё не пройден
                  - у урока НЕТ теста (иначе только через тест)
                */}
                                {!isDone(activeLesson.id) && !activeLesson.test && (
                                    <button onClick={complete} className="btn-primary">
                                        ✓ Отметить пройденным
                                    </button>
                                )}

                                {!isDone(activeLesson.id) && activeLesson.test && (
                                    <div className="chip bg-orange-500/20 text-orange-200">
                                        🔒 Урок завершается только после прохождения теста
                                    </div>
                                )}

                                {nextLesson && (
                                    <button
                                        onClick={() => openLesson(nextLesson)}
                                        disabled={!nextLesson.unlocked}
                                        className={
                                            isDone(activeLesson.id) && nextLesson.unlocked
                                                ? 'btn-primary'
                                                : 'btn-ghost'
                                        }
                                        title={!nextLesson.unlocked ? nextLesson.lockReason : ''}
                                    >
                                        {nextLesson.unlocked
                                            ? 'Следующий урок →'
                                            : `🔒 ${nextLesson.lockReason || 'Следующий закрыт'}`}
                                    </button>
                                )}
                                <button onClick={backToList} className="md:hidden btn-ghost">
                                    ← К урокам
                                </button>
                            </div>

                            {activeLesson.test && (
                                <div className="mt-6 pt-6 border-t border-white/10">
                                    <h3 className="text-lg md:text-xl font-bold mb-1">
                                        🎯 Тестирование
                                    </h3>
                                    <p className="text-xs text-white/40 mb-4">
                                        {activeLesson.test.questions.length} вопросов · проходной балл{' '}
                                        {activeLesson.test.passScore}%
                                    </p>

                                    {testResult ? (
                                        <TestResult
                                            result={testResult}
                                            onRetry={() => setTestResult(null)}
                                            nextLesson={nextLesson}
                                            onNextLesson={() => nextLesson && openLesson(nextLesson)}
                                        />
                                    ) : (
                                        <TestForm
                                            test={activeLesson.test}
                                            answers={answers}
                                            setAnswers={setAnswers}
                                            onSubmit={submitTest}
                                        />
                                    )}
                                </div>
                            )}
                        </article>
                    ) : (
                        <div className="card p-8 md:p-10 text-center text-white/50 text-sm md:text-base">
                            {course.enrolled
                                ? 'Выбери урок'
                                : 'Запишись на курс, чтобы получить доступ к урокам'}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

/* ─────── Результат теста с разбором ошибок ─────── */
function TestResult({ result, onRetry, nextLesson, onNextLesson }) {
    const [showErrors, setShowErrors] = useState(false);
    const wrong = result.wrongQuestions || [];

    return (
        <div className="space-y-4">
            <div className="card p-5 text-center">
                <Sticker id={result.passed ? 'top' : 'fire'} size={110} />
                <div className="text-2xl font-bold mt-3">{result.score}%</div>
                <div className={result.passed ? 'text-lime' : 'text-pink'}>
                    {result.passed ? 'Тест пройден!' : 'Попробуй ещё раз'}
                </div>
                {result.totalQuestions && (
                    <div className="text-xs text-white/40 mt-2">
                        Верных ответов: {result.totalQuestions - wrong.length} из{' '}
                        {result.totalQuestions}
                    </div>
                )}

                <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {!result.passed && (
                        <button onClick={onRetry} className="btn-ghost">
                            Пройти заново
                        </button>
                    )}
                    {wrong.length > 0 && (
                        <button
                            onClick={() => setShowErrors((v) => !v)}
                            className="btn-ghost"
                        >
                            {showErrors
                                ? 'Скрыть разбор'
                                : `Разбор ошибок (${wrong.length})`}
                        </button>
                    )}
                    {result.passed && nextLesson && nextLesson.unlocked && (
                        <button onClick={onNextLesson} className="btn-primary">
                            Следующий урок →
                        </button>
                    )}
                </div>
            </div>

            {showErrors && wrong.length > 0 && (
                <div className="space-y-3">
                    <div className="text-sm text-white/50 px-1">
                        Ниже только вопросы, в которых были ошибки. Правильные ответы
                        намеренно не показываются — рекомендуем вернуться к уроку и
                        попробовать снова.
                    </div>
                    {wrong.map((q, i) => (
                        <WrongQuestionCard key={q.id} q={q} index={i} />
                    ))}
                </div>
            )}
        </div>
    );
}

function WrongQuestionCard({ q, index }) {
    const payload = (() => {
        try {
            return JSON.parse(q.payload || '{}');
        } catch {
            return {};
        }
    })();
    const userAnswer = q.userAnswer;

    return (
        <div className="card p-4 border-l-4" style={{ borderLeftColor: '#EC4899' }}>
            <div className="flex items-start gap-2 mb-3">
        <span className="chip bg-pink/20 text-pink-soft text-[10px] shrink-0">
          Ошибка
        </span>
                <span className="chip bg-white/5 text-[10px] shrink-0">
          {typeLabel(q.type)}
        </span>
                <div className="font-semibold flex-1 text-sm md:text-base">
                    {index + 1}. {q.text}
                </div>
            </div>

            <div className="text-xs text-white/50 mb-2">Ваш ответ:</div>

            {q.type === 'single' && (
                <div className="p-3 rounded-xl bg-pink/10 border border-pink/30 text-sm">
                    {payload.options?.[userAnswer] ?? '— (нет ответа)'}
                </div>
            )}

            {q.type === 'multiple' && (
                <div className="space-y-1">
                    {(payload.options || []).map((o, idx) => {
                        if (!Array.isArray(userAnswer) || !userAnswer.includes(idx)) return null;
                        return (
                            <div
                                key={idx}
                                className="p-2 rounded-lg bg-pink/10 border border-pink/30 text-sm"
                            >
                                {o}
                            </div>
                        );
                    })}
                    {(!Array.isArray(userAnswer) || userAnswer.length === 0) && (
                        <div className="p-2 rounded-lg bg-pink/10 text-sm text-white/50">
                            — (нет ответа)
                        </div>
                    )}
                </div>
            )}

            {q.type === 'matching' && (
                <div className="space-y-1">
                    {(payload.left || []).map((l, li) => {
                        const rightIdx =
                            userAnswer && typeof userAnswer === 'object'
                                ? userAnswer[li]
                                : undefined;
                        return (
                            <div key={li} className="flex items-center gap-2 text-sm">
                                <div className="flex-1 p-2 rounded-lg bg-white/5 truncate">{l}</div>
                                <span className="text-white/40">→</span>
                                <div className="flex-1 p-2 rounded-lg bg-pink/10 border border-pink/30 truncate">
                                    {rightIdx !== undefined && rightIdx !== null
                                        ? payload.right?.[rightIdx] ?? '—'
                                        : '— (нет ответа)'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {q.type === 'text' && (
                <div className="p-3 rounded-xl bg-pink/10 border border-pink/30 text-sm">
                    {userAnswer ? `«${userAnswer}»` : '— (нет ответа)'}
                </div>
            )}

            {q.type === 'order' && (
                <div className="space-y-1">
                    {(userAnswer || []).map((origIdx, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-2 p-2 rounded-lg bg-pink/10 border border-pink/30 text-sm"
                        >
                            <div className="w-6 h-6 shrink-0 grid place-items-center rounded-full bg-white/10 text-xs font-bold">
                                {i + 1}
                            </div>
                            <div className="flex-1 truncate">
                                {payload.items?.[origIdx] ?? '—'}
                            </div>
                        </div>
                    ))}
                    {(!Array.isArray(userAnswer) || userAnswer.length === 0) && (
                        <div className="p-2 rounded-lg bg-pink/10 text-sm text-white/50">
                            — (нет ответа)
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function TestForm({ test, answers, setAnswers, onSubmit }) {
    const allAnswered = useMemo(() => {
        return test.questions.every((q) => {
            const a = answers[q.id];
            if (a === undefined || a === null) return false;
            if (q.type === 'text') return String(a).trim().length > 0;
            if (q.type === 'multiple') return Array.isArray(a) && a.length > 0;
            if (q.type === 'order') return Array.isArray(a) && a.length > 0;
            if (q.type === 'matching') return a && Object.keys(a).length > 0;
            return true;
        });
    }, [test, answers]);

    return (
        <div className="space-y-4">
            {test.questions.map((q, i) => {
                const payload = (() => {
                    try {
                        return JSON.parse(q.payload || '{}');
                    } catch {
                        return {};
                    }
                })();
                return (
                    <div key={q.id} className="card p-4">
                        <div className="flex items-start gap-2 mb-3">
              <span className="chip bg-white/5 text-[10px] shrink-0">
                {typeLabel(q.type)}
              </span>
                            <div className="font-semibold flex-1 text-sm md:text-base">
                                {i + 1}. {q.text}
                            </div>
                        </div>
                        <QuestionBody
                            q={q}
                            payload={payload}
                            value={answers[q.id]}
                            onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
                        />
                    </div>
                );
            })}

            <button
                disabled={!allAnswered}
                onClick={() => onSubmit(test.id)}
                className="btn-primary w-full md:w-auto disabled:opacity-50"
                title={allAnswered ? '' : 'Ответьте на все вопросы'}
            >
                Завершить тест
            </button>
        </div>
    );
}

function typeLabel(t) {
    return (
        {
            single: 'Один ответ',
            multiple: 'Несколько',
            matching: 'Соответствие',
            text: 'Текст',
            order: 'Порядок',
        }[t] || 'Вопрос'
    );
}

function QuestionBody({ q, payload, value, onChange }) {
    if (q.type === 'single') {
        return (
            <div className="space-y-2">
                {(payload.options || []).map((o, idx) => (
                    <label
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer text-sm md:text-base ${
                            value === idx ? 'bg-violet/20' : 'bg-white/5 hover:bg-white/10'
                        }`}
                    >
                        <input
                            type="radio"
                            name={q.id}
                            checked={value === idx}
                            onChange={() => onChange(idx)}
                        />
                        <span>{o}</span>
                    </label>
                ))}
            </div>
        );
    }

    if (q.type === 'multiple') {
        const cur = Array.isArray(value) ? value : [];
        const toggle = (idx) =>
            onChange(cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx]);
        return (
            <div className="space-y-2">
                {(payload.options || []).map((o, idx) => (
                    <label
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer text-sm md:text-base ${
                            cur.includes(idx) ? 'bg-violet/20' : 'bg-white/5 hover:bg-white/10'
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={cur.includes(idx)}
                            onChange={() => toggle(idx)}
                        />
                        <span>{o}</span>
                    </label>
                ))}
            </div>
        );
    }

    if (q.type === 'matching') {
        const left = payload.left || [];
        const right = payload.right || [];
        const cur = value && typeof value === 'object' ? value : {};
        return (
            <div className="space-y-2">
                {left.map((l, li) => (
                    <div key={li} className="flex items-center gap-2 flex-wrap">
                        <div className="flex-1 min-w-[120px] p-2 rounded-xl bg-white/5 text-sm">
                            {l}
                        </div>
                        <span className="text-white/40">→</span>
                        <select
                            className="input !py-2 flex-1 min-w-[140px] text-sm"
                            value={cur[li] ?? ''}
                            onChange={(e) =>
                                onChange({
                                    ...cur,
                                    [li]:
                                        e.target.value === '' ? undefined : Number(e.target.value),
                                })
                            }
                        >
                            <option value="">—</option>
                            {right.map((r, ri) => (
                                <option key={ri} value={ri}>
                                    {r}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
        );
    }

    if (q.type === 'text') {
        return (
            <input
                className="input"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Введите ответ…"
            />
        );
    }

    if (q.type === 'order') {
        const items = payload.items || [];
        const order =
            Array.isArray(value) && value.length === items.length
                ? value
                : items.map((_, i) => i);
        const move = (i, dir) => {
            const arr = [...order];
            const j = i + dir;
            if (j < 0 || j >= arr.length) return;
            [arr[i], arr[j]] = [arr[j], arr[i]];
            onChange(arr);
        };
        return (
            <div className="space-y-2">
                {order.map((origIdx, i) => (
                    <div
                        key={origIdx}
                        className="flex items-center gap-2 p-2 rounded-xl bg-white/5"
                    >
                        <div className="w-6 h-6 shrink-0 grid place-items-center rounded-full bg-white/10 text-xs font-bold">
                            {i + 1}
                        </div>
                        <div className="flex-1 text-sm">{items[origIdx]}</div>
                        <button
                            onClick={() => move(i, -1)}
                            disabled={i === 0}
                            className="btn-ghost !py-1 !px-2 text-xs disabled:opacity-30"
                        >
                            ↑
                        </button>
                        <button
                            onClick={() => move(i, 1)}
                            disabled={i === order.length - 1}
                            className="btn-ghost !py-1 !px-2 text-xs disabled:opacity-30"
                        >
                            ↓
                        </button>
                    </div>
                ))}
            </div>
        );
    }

    return null;
}