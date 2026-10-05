import { useState } from 'react';
import { api } from '../../../../api/client.js';
import LessonEditor from './LessonEditor.jsx';

export default function CourseEditor({ course, token, onClose, onSaved }) {
    const isNew = !course;
    const [form, setForm] = useState(() => ({
        title: course?.title || '',
        slug: course?.slug || '',
        description: course?.description || '',
        category: course?.category || 'photo',
        level: course?.level || 'beginner',
        cover: course?.cover || '',
        published: course?.published ?? false,
        certificateTitle: course?.certificateTitle || 'Сертификат о прохождении курса',
        certificateDescription: course?.certificateDescription || '',
        dripMode: course?.dripMode || '',
        dripInterval: course?.dripInterval ?? 7,
        weeklyLessonLimit: course?.weeklyLessonLimit ?? 3,
    }));
    const [lessons, setLessons] = useState(course?.lessons || []);
    const [savedCourse, setSavedCourse] = useState(course || null);
    const [activeLesson, setActiveLesson] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const saveCourse = async () => {
        setBusy(true);
        setError('');
        try {
            const payload = {
                ...form,
                dripMode: form.dripMode || null,
                dripInterval:
                    form.dripMode === 'schedule'
                        ? Number(form.dripInterval) || 7
                        : null,
                weeklyLessonLimit:
                    form.dripMode === 'test_weekly'
                        ? Number(form.weeklyLessonLimit) || 3
                        : null,
            };

            let saved;
            if (isNew || !savedCourse) {
                const slug =
                    form.slug ||
                    form.title
                        .toLowerCase()
                        .replace(/\s+/g, '-')
                        .slice(0, 30) +
                    '-' +
                    Date.now().toString(36);
                saved = await api('/admin/courses', {
                    method: 'POST',
                    token,
                    body: { ...payload, slug },
                });
            } else {
                saved = await api(`/admin/courses/${savedCourse.id}`, {
                    method: 'PATCH',
                    token,
                    body: payload,
                });
            }
            const full = await api(`/admin/courses/${saved.id}`, { token });
            setSavedCourse(full);
            setLessons(full.lessons || []);
            setForm((f) => ({
                ...f,
                slug: full.slug,
                dripMode: full.dripMode || '',
                dripInterval: full.dripInterval ?? 7,
                weeklyLessonLimit: full.weeklyLessonLimit ?? 3,
            }));
        } catch (e) {
            setError(e.message || 'Ошибка сохранения');
        } finally {
            setBusy(false);
        }
    };

    const addLesson = async () => {
        if (!savedCourse) {
            setError('Сначала сохраните курс');
            return;
        }
        try {
            const lesson = await api(`/admin/courses/${savedCourse.id}/lessons`, {
                method: 'POST',
                token,
                body: {
                    title: 'Новый урок',
                    content: '',
                    order: lessons.length + 1,
                    duration: 0,
                },
            });
            const full = await api(`/admin/courses/${savedCourse.id}`, { token });
            setLessons(full.lessons);
            setActiveLesson(full.lessons.find((l) => l.id === lesson.id));
        } catch (e) {
            setError(e.message);
        }
    };

    const refreshLessons = async () => {
        if (!savedCourse) return;
        const full = await api(`/admin/courses/${savedCourse.id}`, { token });
        setLessons(full.lessons);
        setActiveLesson((prev) =>
            prev ? full.lessons.find((l) => l.id === prev.id) || prev : prev
        );
    };

    const moveLesson = async (lesson, dir) => {
        const idx = lessons.findIndex((l) => l.id === lesson.id);
        const swapWith = lessons[idx + dir];
        if (!swapWith) return;
        try {
            await api(`/admin/lessons/${lesson.id}`, {
                method: 'PATCH',
                token,
                body: { order: swapWith.order },
            });
            await api(`/admin/lessons/${swapWith.id}`, {
                method: 'PATCH',
                token,
                body: { order: lesson.order },
            });
            await refreshLessons();
        } catch (e) {
            alert(e.message);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto p-3 md:p-6"
            onClick={onClose}
        >
            <div
                className="card max-w-6xl mx-auto my-4 p-5 md:p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                    <h2 className="text-2xl font-bold">
                        {isNew ? 'Новый курс' : `Курс: ${savedCourse?.title || form.title}`}
                    </h2>
                    <div className="flex gap-2">
                        {savedCourse?.slug && (
                            <a
                                href={`/app/courses/${savedCourse.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-ghost !py-1 text-xs"
                            >
                                👁 Просмотр
                            </a>
                        )}
                        <button
                            onClick={onClose}
                            className="text-white/40 hover:text-white text-xl"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        {error}
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-3 mb-6">
                    <div className="md:col-span-2">
                        <label className="text-xs text-white/40 uppercase block mb-1">
                            Название
                        </label>
                        <input className="input" value={form.title} onChange={set('title')} />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">
                            Slug (URL)
                        </label>
                        <input
                            className="input"
                            value={form.slug}
                            onChange={set('slug')}
                            placeholder="auto"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">
                            Категория
                        </label>
                        <select
                            className="input"
                            value={form.category}
                            onChange={set('category')}
                        >
                            <option value="photo">📸 Фото</option>
                            <option value="video">🎥 Видео</option>
                            <option value="radio">📻 Радио</option>
                            <option value="sound">🎚️ Звук</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">
                            Уровень
                        </label>
                        <select className="input" value={form.level} onChange={set('level')}>
                            <option value="beginner">beginner</option>
                            <option value="intermediate">intermediate</option>
                            <option value="advanced">advanced</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">
                            Обложка (URL)
                        </label>
                        <input className="input" value={form.cover} onChange={set('cover')} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-white/40 uppercase block mb-1">
                            Описание
                        </label>
                        <textarea
                            rows={3}
                            className="input resize-none"
                            value={form.description}
                            onChange={set('description')}
                        />
                    </div>

                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">
                            Drip-режим
                        </label>
                        <select
                            className="input"
                            value={form.dripMode}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, dripMode: e.target.value }))
                            }
                        >
                            <option value="">Открыт сразу</option>
                            <option value="test">После теста (по порядку)</option>
                            <option value="test_weekly">После теста + лимит в неделю</option>
                            <option value="schedule">По расписанию</option>
                        </select>
                        <div className="text-[11px] text-white/40 mt-1">
                            {form.dripMode === 'test' &&
                                'Каждый следующий урок откроется только после успешной сдачи теста предыдущего.'}
                            {form.dripMode === 'test_weekly' &&
                                'Каждую неделю открывается новая порция уроков. Внутри порции — только после сдачи теста предыдущего.'}
                            {form.dripMode === 'schedule' &&
                                'Уроки будут открываться с заданным интервалом от даты записи.'}
                            {!form.dripMode && 'Все уроки доступны сразу.'}
                        </div>
                    </div>

                    {form.dripMode === 'schedule' && (
                        <div>
                            <label className="text-xs text-white/40 uppercase block mb-1">
                                Интервал (дней)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="90"
                                className="input"
                                value={form.dripInterval}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        dripInterval: Number(e.target.value) || 7,
                                    }))
                                }
                            />
                        </div>
                    )}

                    {form.dripMode === 'test_weekly' && (
                        <div>
                            <label className="text-xs text-white/40 uppercase block mb-1">
                                Уроков в неделю
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                className="input"
                                value={form.weeklyLessonLimit}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        weeklyLessonLimit: Number(e.target.value) || 3,
                                    }))
                                }
                            />
                            <div className="text-[11px] text-white/40 mt-1">
                                Сколько уроков может быть доступно в течение одной недели.
                            </div>
                        </div>
                    )}

                    <div className="md:col-span-2">
                        <label className="text-xs text-white/40 uppercase block mb-1">
                            Заголовок сертификата
                        </label>
                        <input
                            className="input"
                            value={form.certificateTitle}
                            onChange={set('certificateTitle')}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-white/40 uppercase block mb-1">
                            Описание сертификата
                        </label>
                        <textarea
                            rows={2}
                            className="input resize-none"
                            value={form.certificateDescription}
                            onChange={set('certificateDescription')}
                        />
                    </div>

                    <label className="flex items-center gap-2 md:col-span-2">
                        <input
                            type="checkbox"
                            checked={form.published}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, published: e.target.checked }))
                            }
                        />
                        Опубликован
                    </label>
                </div>

                <div className="flex justify-end mb-6">
                    <button onClick={saveCourse} disabled={busy} className="btn-primary">
                        {busy ? 'Сохранение…' : isNew ? 'Создать курс' : 'Сохранить курс'}
                    </button>
                </div>

                {savedCourse && (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-bold">
                                Уроки ({lessons.length})
                            </h3>
                            <button
                                onClick={addLesson}
                                className="btn-ghost !py-2 text-sm"
                            >
                                ＋ Добавить урок
                            </button>
                        </div>
                        <div className="grid md:grid-cols-[320px_1fr] gap-4">
                            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
                                {lessons.map((l, i) => (
                                    <div
                                        key={l.id}
                                        className={`rounded-xl flex items-center gap-2 ${
                                            activeLesson?.id === l.id
                                                ? 'bg-white/10'
                                                : 'hover:bg-white/5'
                                        }`}
                                    >
                                        <button
                                            onClick={() => setActiveLesson(l)}
                                            className="flex-1 text-left p-3 flex items-center gap-3 min-w-0"
                                        >
                                            <div className="w-7 h-7 grid place-items-center rounded-full bg-white/10 text-xs font-bold shrink-0">
                                                {i + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold truncate">
                                                    {l.title}
                                                </div>
                                                <div className="text-xs text-white/40 flex gap-2 flex-wrap">
                                                    <span>{l.duration} мин</span>
                                                    {l.test && (
                                                        <span>
                                                            ·{' '}
                                                            {l.test.questions?.length || 0}{' '}
                                                            вопр.
                                                        </span>
                                                    )}
                                                    {l.practical && <span>· 🎯</span>}
                                                    {l.homework && <span>· 📋</span>}
                                                </div>
                                            </div>
                                        </button>
                                        <div className="flex flex-col gap-0.5 pr-2">
                                            <button
                                                onClick={() => moveLesson(l, -1)}
                                                disabled={i === 0}
                                                className="text-white/40 hover:text-white text-xs disabled:opacity-20"
                                                title="Выше"
                                            >
                                                ▲
                                            </button>
                                            <button
                                                onClick={() => moveLesson(l, 1)}
                                                disabled={i === lessons.length - 1}
                                                className="text-white/40 hover:text-white text-xs disabled:opacity-20"
                                                title="Ниже"
                                            >
                                                ▼
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {lessons.length === 0 && (
                                    <div className="text-white/40 text-sm p-3">
                                        Уроков нет
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                {activeLesson ? (
                                    <LessonEditor
                                        key={activeLesson.id}
                                        lesson={activeLesson}
                                        token={token}
                                        onDeleted={() => {
                                            setActiveLesson(null);
                                            refreshLessons();
                                        }}
                                        onSaved={refreshLessons}
                                    />
                                ) : (
                                    <div className="card p-6 text-center text-white/40 text-sm">
                                        Выберите урок слева
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {!savedCourse && (
                    <div className="text-center text-white/40 text-sm py-3">
                        Сохраните курс, чтобы добавлять уроки
                    </div>
                )}

                <div className="flex justify-end mt-6">
                    <button onClick={onSaved} className="btn-primary">
                        Готово
                    </button>
                </div>
            </div>
        </div>
    );
}