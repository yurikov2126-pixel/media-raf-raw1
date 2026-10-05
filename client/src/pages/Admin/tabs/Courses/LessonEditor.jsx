import { useState } from 'react';
import { api } from '../../../../api/client.js';
import TestEditor from './TestEditor.jsx';
import PracticalEditor from './PracticalEditor.jsx';
import HomeworkEditor from './HomeworkEditor.jsx';
import MarkdownView from '../../../../components/MarkdownView.jsx';

export default function LessonEditor({ lesson, token, onSaved, onDeleted }) {
    const [tab, setTab] = useState('lesson');
    const [form, setForm] = useState({
        title: lesson.title,
        content: lesson.content || '',
        videoUrl: lesson.videoUrl || '',
        order: lesson.order ?? 0,
        duration: lesson.duration ?? 0,
        requiresPractical: lesson.requiresPractical ?? !!lesson.practical,
    });
    const [test, setTest] = useState(lesson.test || null);
    const [practical, setPractical] = useState(lesson.practical || null);
    const [homework, setHomework] = useState(lesson.homework || null);
    const [busy, setBusy] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const save = async () => {
        setBusy(true);
        try {
            await api(`/admin/lessons/${lesson.id}`, {
                method: 'PATCH',
                token,
                body: {
                    title: form.title,
                    content: form.content,
                    videoUrl: form.videoUrl || null,
                    order: Number(form.order) || 0,
                    duration: Number(form.duration) || 0,
                },
            });
            onSaved?.();
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!confirm('Удалить урок?')) return;
        await api(`/admin/lessons/${lesson.id}`, { method: 'DELETE', token });
        onDeleted?.();
    };

    const createTest = async () => {
        const t = await api(`/admin/lessons/${lesson.id}/test`, {
            method: 'POST',
            token,
            body: { title: `Тест: ${form.title}`, passScore: 70 },
        });
        setTest({ ...t, questions: [] });
    };

    const deleteTest = async () => {
        if (!confirm('Удалить тест?')) return;
        await api(`/admin/tests/${test.id}`, { method: 'DELETE', token });
        setTest(null);
    };

    return (
        <div className="space-y-4 min-w-0">
            {/* Шапка урока */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-bold text-lg">Редактор урока</div>
                <div className="flex gap-1 flex-wrap">
                    <button
                        onClick={remove}
                        className="chip bg-white/5 hover:bg-pink/30 text-xs"
                        type="button"
                    >
                        🗑️ Удалить урок
                    </button>
                </div>
            </div>

            <input
                className="input text-lg font-semibold"
                value={form.title}
                onChange={set('title')}
                placeholder="Название урока"
            />

            {/* Вкладки */}
            <div className="flex gap-1 border-b border-white/10 pb-2 flex-wrap">
                <TabBtn active={tab === 'lesson'} onClick={() => setTab('lesson')}>
                    📖 Урок
                </TabBtn>
                <TabBtn active={tab === 'test'} onClick={() => setTab('test')}>
                    📝 Тест {test ? `(${test.questions?.length || 0})` : ''}
                </TabBtn>
                <TabBtn active={tab === 'practical'} onClick={() => setTab('practical')}>
                    🎯 Практика {practical ? '✓' : ''}
                </TabBtn>
                <TabBtn active={tab === 'homework'} onClick={() => setTab('homework')}>
                    📋 ДЗ {homework ? '✓' : ''}
                </TabBtn>
            </div>

            {/* Вкладка урока */}
            {tab === 'lesson' && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-white/40 uppercase">
                            Контент урока {showPreview ? '(превью)' : '(markdown)'}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowPreview((s) => !s)}
                            className="text-xs text-violet-soft hover:underline"
                        >
                            {showPreview ? '✎ Редактор' : '👁 Превью'}
                        </button>
                    </div>

                    {showPreview ? (
                        <div className="border border-white/10 rounded-xl p-4 h-[420px] overflow-y-auto bg-black/20">
                            <MarkdownView
                                text={form.content}
                                className="text-white/85 text-sm"
                            />
                            {!form.content && (
                                <div className="text-white/30 italic">Пустой контент</div>
                            )}
                        </div>
                    ) : (
                        <textarea
                            className="input resize-none font-mono text-xs leading-relaxed h-[420px]"
                            value={form.content}
                            onChange={set('content')}
                            placeholder="## Заголовок&#10;&#10;Текст урока в markdown…"
                        />
                    )}

                    <div className="grid md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                            <label className="text-xs text-white/40 uppercase block mb-1">URL видео</label>
                            <input
                                className="input"
                                value={form.videoUrl}
                                onChange={set('videoUrl')}
                                placeholder="https://www.youtube.com/watch?v=..."
                            />
                            {form.videoUrl && (
                                <div className="mt-2 rounded-lg overflow-hidden aspect-video bg-black max-w-md">
                                    {/youtu\.?be/.test(form.videoUrl) ? (
                                        <iframe
                                            src={form.videoUrl
                                                .replace('watch?v=', 'embed/')
                                                .replace('youtu.be/', 'www.youtube.com/embed/')}
                                            className="w-full h-full"
                                            allowFullScreen
                                            title="preview"
                                        />
                                    ) : (
                                        <div className="w-full h-full grid place-items-center text-xs text-white/40">
                                            Предпросмотр доступен для YouTube
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-xs text-white/40 uppercase block mb-1">Порядок</label>
                            <input
                                type="number"
                                className="input"
                                value={form.order}
                                onChange={set('order')}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-white/40 uppercase block mb-1">Длительность (мин)</label>
                            <input
                                type="number"
                                className="input"
                                value={form.duration}
                                onChange={set('duration')}
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button onClick={save} disabled={busy} className="btn-primary flex-1">
                            {busy ? 'Сохранение…' : '💾 Сохранить урок'}
                        </button>
                    </div>
                </div>
            )}

            {/* Вкладка теста */}
            {tab === 'test' && (
                <div>
                    {!test ? (
                        <div className="text-center py-8">
                            <div className="text-4xl mb-3">📝</div>
                            <div className="text-white/60 mb-4">У этого урока пока нет теста</div>
                            <button onClick={createTest} className="btn-primary">
                                ＋ Создать тест
                            </button>
                        </div>
                    ) : (
                        <TestEditor
                            test={test}
                            setTest={setTest}
                            token={token}
                            onDelete={deleteTest}
                        />
                    )}
                </div>
            )}

            {/* Вкладка практики */}
            {tab === 'practical' && (
                <PracticalEditor
                    lessonId={lesson.id}
                    practical={practical}
                    setPractical={setPractical}
                    token={token}
                    onChanged={() => {
                        onSaved?.();
                    }}
                />
            )}

            {/* Вкладка ДЗ */}
            {tab === 'homework' && (
                <HomeworkEditor
                    lessonId={lesson.id}
                    homework={homework}
                    setHomework={setHomework}
                    token={token}
                    onChanged={() => {
                        onSaved?.();
                    }}
                />
            )}
        </div>
    );
}

function TabBtn({ active, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-xs transition ${
                active ? 'bg-violet-soft/20 text-white' : 'text-white/60 hover:bg-white/5'
            }`}
        >
            {children}
        </button>
    );
}