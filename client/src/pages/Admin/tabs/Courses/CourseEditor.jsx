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
    }));
    const [lessons, setLessons] = useState(course?.lessons || []);
    const [savedCourse, setSavedCourse] = useState(course || null);
    const [activeLesson, setActiveLesson] = useState(null);
    const [busy, setBusy] = useState(false);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const saveCourse = async () => {
        setBusy(true);
        try {
            const payload = {
                ...form,
                dripMode: form.dripMode || null,
                dripInterval: form.dripMode === 'schedule' ? Number(form.dripInterval) || 7 : null,
            };

            let saved;
            if (isNew || !savedCourse) {
                const slug = form.slug || form.title.toLowerCase().replace(/\s+/g, '-').slice(0, 30) + '-' + Date.now().toString(36);
                saved = await api('/admin/courses', { method: 'POST', token, body: { ...payload, slug } });
            } else {
                saved = await api(`/admin/courses/${savedCourse.id}`, { method: 'PATCH', token, body: payload });
            }
            const full = await api(`/admin/courses/${saved.id}`, { token });
            setSavedCourse(full);
            setLessons(full.lessons || []);
            setForm((f) => ({ ...f, slug: full.slug }));
        } catch (e) { alert(e.message); }
        finally { setBusy(false); }
    };

    const addLesson = async () => {
        if (!savedCourse) { alert('Сначала сохрани курс'); return; }
        const lesson = await api(`/admin/courses/${savedCourse.id}/lessons`, {
            method: 'POST',
            token,
            body: { title: 'Новый урок', content: '', order: lessons.length + 1, duration: 0 },
        });
        const full = await api(`/admin/courses/${savedCourse.id}`, { token });
        setLessons(full.lessons);
        setActiveLesson(full.lessons.find((l) => l.id === lesson.id));
    };

    const refreshLessons = async () => {
        if (!savedCourse) return;
        const full = await api(`/admin/courses/${savedCourse.id}`, { token });
        setLessons(full.lessons);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto p-3 md:p-6" onClick={onClose}>
            <div className="card max-w-5xl mx-auto my-4 p-5 md:p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">
                        {isNew ? 'Новый курс' : `Курс: ${savedCourse?.title || form.title}`}
                    </h2>
                    <button onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button>
                </div>

                <div className="grid md:grid-cols-2 gap-3 mb-6">
                    <div className="md:col-span-2">
                        <label className="text-xs text-white/40 uppercase block mb-1">Название</label>
                        <input className="input" value={form.title} onChange={set('title')} />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Slug (URL)</label>
                        <input className="input" value={form.slug} onChange={set('slug')} placeholder="auto" />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Категория</label>
                        <select className="input" value={form.category} onChange={set('category')}>
                            <option value="photo">📸 Фото</option>
                            <option value="video">🎥 Видео</option>
                            <option value="radio">📻 Радио</option>
                            <option value="sound">🎚️ Звук</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Уровень</label>
                        <select className="input" value={form.level} onChange={set('level')}>
                            <option value="beginner">beginner</option>
                            <option value="intermediate">intermediate</option>
                            <option value="advanced">advanced</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Обложка (URL)</label>
                        <input className="input" value={form.cover} onChange={set('cover')} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-white/40 uppercase block mb-1">Описание</label>
                        <textarea rows={2} className="input resize-none" value={form.description} onChange={set('description')} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-white/40 uppercase block mb-1">Заголовок сертификата</label>
                        <input className="input" value={form.certificateTitle} onChange={set('certificateTitle')} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-white/40 uppercase block mb-1">Описание сертификата</label>
                        <textarea rows={2} className="input resize-none" value={form.certificateDescription} onChange={set('certificateDescription')} />
                    </div>

                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Drip-режим</label>
                        <select className="input" value={form.dripMode} onChange={(e) => setForm((f) => ({ ...f, dripMode: e.target.value }))}>
                            <option value="">Открыт сразу</option>
                            <option value="test">После теста (по порядку)</option>
                            <option value="schedule">По расписанию</option>
                        </select>
                    </div>
                    {form.dripMode === 'schedule' && (
                        <div>
                            <label className="text-xs text-white/40 uppercase block mb-1">Интервал (дней)</label>
                            <input type="number" min="1" max="90" className="input" value={form.dripInterval} onChange={(e) => setForm((f) => ({ ...f, dripInterval: Number(e.target.value) || 7 }))} />
                        </div>
                    )}

                    <label className="flex items-center gap-2 md:col-span-2">
                        <input type="checkbox" checked={form.published} onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))} />
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
                            <h3 className="text-lg font-bold">Уроки ({lessons.length})</h3>
                            <button onClick={addLesson} className="btn-ghost !py-2 text-sm">＋ Добавить урок</button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                                {lessons.map((l, i) => (
                                    <button
                                        key={l.id}
                                        onClick={() => setActiveLesson(l)}
                                        className={`w-full text-left p-3 rounded-xl flex items-center gap-3 ${activeLesson?.id === l.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="w-7 h-7 grid place-items-center rounded-full bg-white/10 text-xs font-bold">{i + 1}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold truncate">{l.title}</div>
                                            <div className="text-xs text-white/40">
                                                {l.duration} мин · {l.test ? `${l.test.questions?.length || 0} вопр.` : 'без теста'}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                                {lessons.length === 0 && <div className="text-white/40 text-sm p-3">Уроков нет</div>}
                            </div>
                            <div>
                                {activeLesson ? (
                                    <LessonEditor
                                        key={activeLesson.id}
                                        lesson={activeLesson}
                                        token={token}
                                        onDeleted={() => { setActiveLesson(null); refreshLessons(); }}
                                        onSaved={() => refreshLessons()}
                                    />
                                ) : (
                                    <div className="card p-6 text-center text-white/40 text-sm">Выбери урок слева</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {!savedCourse && <div className="text-center text-white/40 text-sm py-3">Сохрани курс, чтобы добавлять уроки</div>}

                <div className="flex justify-end mt-6">
                    <button onClick={onSaved} className="btn-primary">Готово</button>
                </div>
            </div>
        </div>
    );
}