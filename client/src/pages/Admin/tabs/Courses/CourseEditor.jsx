import { useEffect, useState } from 'react';
import { api } from '../../../../api/client.js';
import { useToast } from '../../../../store/toast.jsx';
import LessonEditor from './LessonEditor.jsx';

export default function CourseEditor({ course, token, onClose, onSaved }) {
    const toast = useToast();
    const isNew = !course;
    const [form, setForm] = useState(() => ({
        title: course?.title || '',
        slug: course?.slug || '',
        description: course?.description || '',
        category: course?.category || 'photo',
        competencyIds: (() => { try { return JSON.parse(course?.competencyIds || '[]'); } catch { return []; } })(),
        level: course?.level || 'beginner',
        cover: course?.cover || '',
        published: course?.published ?? false,
        certificateTitle: course?.certificateTitle || 'Сертификат о прохождении курса',
        certificateDescription: course?.certificateDescription || '',
        dripMode: course?.dripMode || '',
        dripInterval: course?.dripInterval ?? 7,
        weeklyLessonLimit: course?.weeklyLessonLimit ?? 3,
    }));
    const [competencies, setCompetencies] = useState([]);
    useEffect(()=>{ api('/competencies',{token}).then(setCompetencies).catch(()=>{}); },[token]);
    const [lessons, setLessons] = useState(course?.lessons || []);
    const [savedCourse, setSavedCourse] = useState(course || null);
    const [activeLesson, setActiveLesson] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('main');
    const [lessonSearch, setLessonSearch] = useState('');

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const saveCourse = async () => {
        setBusy(true);
        setError('');
        try {
            const payload = {
                ...form,
                dripMode: form.dripMode || null,
                dripInterval: form.dripMode === 'schedule' ? Number(form.dripInterval) || 7 : null,
                weeklyLessonLimit: form.dripMode === 'test_weekly' ? Number(form.weeklyLessonLimit) || 3 : null,
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
            setForm((f) => ({
                ...f,
                slug: full.slug,
                published: full.published,
                dripMode: full.dripMode || '',
                dripInterval: full.dripInterval ?? 7,
                weeklyLessonLimit: full.weeklyLessonLimit ?? 3,
            }));
            toast.success(full.published ? 'Курс сохранён и опубликован' : 'Курс сохранён как черновик');
        } catch (e) {
            setError(e.message || 'Ошибка сохранения');
        } finally {
            setBusy(false);
        }
    };

    const addLesson = async () => {
        if (!savedCourse) { setError('Сначала сохраните курс'); return; }
        try {
            const lesson = await api(`/admin/courses/${savedCourse.id}/lessons`, {
                method: 'POST',
                token,
                body: { title: 'Новый урок', content: '', order: lessons.length + 1, duration: 0 },
            });
            const full = await api(`/admin/courses/${savedCourse.id}`, { token });
            setLessons(full.lessons);
            setActiveLesson(full.lessons.find((l) => l.id === lesson.id));
            setTab('lessons');
        } catch (e) {
            setError(e.message);
        }
    };

    const refreshLessons = async () => {
        if (!savedCourse) return;
        const full = await api(`/admin/courses/${savedCourse.id}`, { token });
        setLessons(full.lessons);
        setActiveLesson((prev) => prev ? full.lessons.find((l) => l.id === prev.id) || prev : prev);
    };

    const moveLesson = async (lesson, dir) => {
        const idx = lessons.findIndex((l) => l.id === lesson.id);
        const swapWith = lessons[idx + dir];
        if (!swapWith) return;
        try {
            await api(`/admin/lessons/${lesson.id}`, { method: 'PATCH', token, body: { order: swapWith.order } });
            await api(`/admin/lessons/${swapWith.id}`, { method: 'PATCH', token, body: { order: lesson.order } });
            await refreshLessons();
        } catch (e) {
            toast.error(e.message);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-hidden p-2 md:p-4" onClick={onClose}>
            <div
                className="card w-full max-w-[1600px] h-full mx-auto flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/10 shrink-0">
                    <div className="min-w-0">
                        <div className="text-lg md:text-xl font-bold truncate">
                            {isNew ? 'Новый курс' : savedCourse?.title || form.title}
                        </div>
                        {savedCourse && (
                            <div className="text-xs text-white/40">
                                /{savedCourse.slug} · {lessons.length} уроков
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {savedCourse?.slug && (
                            <a
                                href={`/app/courses/${savedCourse.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-ghost !py-1.5 text-xs"
                            >
                                👁 Просмотр
                            </a>
                        )}
                        <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">✕</button>
                    </div>
                </div>

                <div className="flex gap-1 px-3 md:px-5 border-b border-white/10 shrink-0 overflow-x-auto">
                    <TabBtn active={tab === 'main'} onClick={() => setTab('main')}>
                        📋 Основное
                    </TabBtn>
                    <TabBtn active={tab === 'lessons'} onClick={() => setTab('lessons')} disabled={!savedCourse}>
                        📖 Уроки {lessons.length > 0 && <span className="opacity-60">({lessons.length})</span>}
                    </TabBtn>
                </div>

                <div className="flex-1 overflow-hidden">
                    {tab === 'main' && (
                        <div className="h-full overflow-y-auto p-3 md:p-6">
                            {error && (
                                <div className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                    {error}
                                </div>
                            )}

                            <section className="mb-4 rounded-xl border border-violet-500/30 p-4">
                                <h3 className="font-semibold mb-2">Подтверждаемые компетенции</h3>
                                <p className="text-xs opacity-65 mb-3">После завершения курса студент получит отмеченные компетенции вместе с сертификатом. Справочник — в разделе «Компетенции» админки.</p>
                                <div className="flex flex-wrap gap-2">{competencies.filter(c=>c.active || form.competencyIds.includes(c.id)).map(c=><label key={c.id} className="flex items-center gap-2 rounded-lg border border-current/15 px-3 py-2 text-sm">
                                    <input type="checkbox" disabled={!c.active} checked={form.competencyIds.includes(c.id)}
                                        onChange={e=>setForm(v=>({...v,competencyIds:e.target.checked?[...v.competencyIds,c.id]:v.competencyIds.filter(id=>id!==c.id)}))}/>{c.name}
                                </label>)}</div>
                            </section>
                            <div className="grid md:grid-cols-2 gap-3">
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
                                        <option value="beginner">Для начинающих</option>
                                        <option value="intermediate">Средний уровень</option>
                                        <option value="advanced">Продвинутый</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-white/40 uppercase block mb-1">Обложка (URL)</label>
                                    <input className="input" value={form.cover} onChange={set('cover')} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-white/40 uppercase block mb-1">
                                        Описание (полное, поддерживает markdown)
                                    </label>
                                    <textarea
                                        rows={5}
                                        className="input resize-none font-mono text-xs leading-relaxed"
                                        value={form.description}
                                        onChange={set('description')}
                                        placeholder="Развёрнутое описание курса — что изучается, для кого, что в итоге"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-white/40 uppercase block mb-1">Заголовок сертификата</label>
                                    <input className="input" value={form.certificateTitle} onChange={set('certificateTitle')} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-white/40 uppercase block mb-1">Описание сертификата</label>
                                    <textarea
                                        rows={2}
                                        className="input resize-none"
                                        value={form.certificateDescription}
                                        onChange={set('certificateDescription')}
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-white/40 uppercase block mb-1">Drip-режим</label>
                                    <select className="input" value={form.dripMode} onChange={(e) => setForm((f) => ({ ...f, dripMode: e.target.value }))}>
                                        <option value="">Открыт сразу</option>
                                        <option value="test">После теста (по порядку)</option>
                                        <option value="test_homework">После теста и домашнего задания</option>
                                        <option value="test_weekly">После теста + лимит в неделю</option>
                                        <option value="schedule">По расписанию</option>
                                    </select>
                                    <div className="text-[11px] text-white/40 mt-1">
                                        {form.dripMode === 'test' && 'Каждый следующий урок откроется только после сдачи теста предыдущего.'}
                                        {form.dripMode === 'test_homework' && 'Следующий урок открывается после успешного теста и одобрения домашнего задания. Если есть практика, она также должна быть принята. При отсутствии теста или ДЗ этот шаг пропускается.'}
                                        {form.dripMode === 'test_weekly' && 'Каждую неделю открывается новая порция уроков, внутри порции — после теста.'}
                                        {form.dripMode === 'schedule' && 'Уроки открываются с заданным интервалом от даты записи.'}
                                        {!form.dripMode && 'Все уроки доступны сразу.'}
                                    </div>
                                </div>
                                {form.dripMode === 'schedule' && (
                                    <div>
                                        <label className="text-xs text-white/40 uppercase block mb-1">Интервал (дней)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="90"
                                            className="input"
                                            value={form.dripInterval}
                                            onChange={(e) => setForm((f) => ({ ...f, dripInterval: Number(e.target.value) || 7 }))}
                                        />
                                    </div>
                                )}
                                {form.dripMode === 'test_weekly' && (
                                    <div>
                                        <label className="text-xs text-white/40 uppercase block mb-1">Уроков в неделю</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="50"
                                            className="input"
                                            value={form.weeklyLessonLimit}
                                            onChange={(e) => setForm((f) => ({ ...f, weeklyLessonLimit: Number(e.target.value) || 3 }))}
                                        />
                                    </div>
                                )}

                                <label className="flex items-center gap-2 md:col-span-2">
                                    <input
                                        type="checkbox"
                                        checked={form.published}
                                        onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                                    />
                                    Опубликован
                                </label>
                            </div>

                            <div className="flex justify-end mt-6">
                                <button onClick={saveCourse} disabled={busy} className="btn-primary">
                                    {busy ? 'Сохранение…' : isNew ? 'Создать курс' : 'Сохранить курс'}
                                </button>
                            </div>
                        </div>
                    )}

                    {tab === 'lessons' && savedCourse && (
                        <div className="h-full flex flex-col min-h-0">
                            <div className="flex items-center justify-between gap-2 px-3 md:px-5 py-3 border-b border-white/5 shrink-0">
                                <div className="text-sm text-white/60">
                                    Всего: <b className="text-white">{lessons.length}</b>
                                    {activeLesson && (
                                        <span className="text-white/40 ml-2">
                                            · выбран: <b className="text-white/80">{activeLesson.title}</b>
                                        </span>
                                    )}
                                </div>
                                <button onClick={addLesson} className="btn-ghost !py-1.5 text-sm">
                                    ＋ Добавить урок
                                </button>
                            </div>

                            <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
                                <aside className="lg:w-[310px] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col min-h-0 max-h-[36vh] lg:max-h-none bg-black/10">
                                    <div className="p-3 border-b border-white/10">
                                        <label className="text-xs text-white/65 block mb-2">Быстрый поиск урока</label>
                                        <input className="input text-sm" value={lessonSearch} onChange={(e) => setLessonSearch(e.target.value)} placeholder="Название или номер урока" />
                                    </div>
                                    <div className="overflow-y-auto p-2 space-y-1">
                                        {lessons.filter((l) => (String(l.order) + ' ' + l.title).toLowerCase().includes(lessonSearch.toLowerCase())).map((l) => (
                                            <button type="button" key={l.id} onClick={() => setActiveLesson(l)}
                                                aria-current={activeLesson?.id === l.id ? 'page' : undefined}
                                                className={`w-full text-left rounded-xl p-3 border transition ${activeLesson?.id === l.id
                                                    ? 'bg-violet-soft/20 border-violet-soft/50 text-white'
                                                    : 'bg-white/5 border-transparent hover:bg-white/10 text-white/80'}`}>
                                                <div className="flex gap-2 items-start"><span className="text-xs text-white/60 shrink-0 mt-0.5 w-6">{l.order}.</span>
                                                    <span className="font-semibold text-sm break-words min-w-0">{l.title}</span></div>
                                                <div className="flex gap-2 flex-wrap text-xs text-white/60 mt-2 ml-8">
                                                    {!!l.duration && <span>⏱ {l.duration} мин</span>}
                                                    {l.test && <span>📝 Тест</span>}
                                                    {l.practical && <span>🎯 Практика</span>}
                                                    {l.homework && <span>📋 ДЗ</span>}
                                                </div>
                                            </button>
                                        ))}
                                        {lessons.length === 0 && <p className="text-white/60 text-sm p-4">Уроков пока нет. Создайте первый.</p>}
                                        {lessons.length > 0 && !lessons.some((l) => (String(l.order) + ' ' + l.title).toLowerCase().includes(lessonSearch.toLowerCase())) && <p className="p-4 text-sm text-white/60">По запросу ничего не найдено</p>}
                                    </div>
                                </aside>
                                <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-3 md:p-5">
                                    {activeLesson ? (
                                        <LessonEditor
                                            key={activeLesson.id}
                                            lesson={activeLesson}
                                            token={token}
                                            onDeleted={() => { setActiveLesson(null); refreshLessons(); }}
                                            onSaved={refreshLessons}
                                        />
                                    ) : (
                                        <div className="h-full min-h-44 grid place-items-center text-white/60 text-sm text-center">
                                            <div><div className="text-3xl mb-2">📖</div>Выберите урок в списке слева<br />или добавьте новый</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 px-5 py-3 border-t border-white/10 shrink-0">
                    <button onClick={onClose} className="btn-ghost">Закрыть</button>
                    <button onClick={onSaved} className="btn-primary">Готово</button>
                </div>
            </div>
        </div>
    );
}

function TabBtn({ active, onClick, children, disabled }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`px-4 py-2 text-sm transition border-b-2 -mb-px disabled:opacity-30 ${
                active ? 'border-violet-soft text-white' : 'border-transparent text-white/50 hover:text-white'
            }`}
        >
            {children}
        </button>
    );
}