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
        <div className="card p-4 space-y-3 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-bold">Урок</div>
                <div className="flex gap-1 flex-wrap">
                    <button
                        onClick={() => setShowPreview((s) => !s)}
                        className="chip bg-white/5 hover:bg-white/10 text-xs"
                        type="button"
                    >
                        {showPreview ? '✎ Редактор' : '👁 Превью'}
                    </button>
                    <button
                        onClick={remove}
                        className="chip bg-white/5 hover:bg-pink/30 text-xs"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            <input
                className="input"
                value={form.title}
                onChange={set('title')}
                placeholder="Название"
            />

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

            {tab === 'lesson' && (
                <>
                    {showPreview ? (
                        <div className="border border-white/10 rounded-xl p-3 max-h-[400px] overflow-y-auto bg-black/20">
                            <MarkdownView
                                text={form.content}
                                className="text-white/85 text-sm"
                            />
                        </div>
                    ) : (
                        <textarea
                            rows={12}
                            className="input resize-none font-mono text-xs leading-relaxed"
                            value={form.content}
                            onChange={set('content')}
                            placeholder="Markdown-контент урока"
                        />
                    )}
                    <input
                        className="input"
                        value={form.videoUrl}
                        onChange={set('videoUrl')}
                        placeholder="URL видео (если есть)"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="number"
                            className="input"
                            value={form.order}
                            onChange={set('order')}
                            placeholder="Порядок"
                        />
                        <input
                            type="number"
                            className="input"
                            value={form.duration}
                            onChange={set('duration')}
                            placeholder="Длительность (мин)"
                        />
                    </div>
                    <button
                        onClick={save}
                        disabled={busy}
                        className="btn-primary w-full"
                    >
                        {busy ? 'Сохранение…' : 'Сохранить урок'}
                    </button>
                </>
            )}

            {tab === 'test' && (
                <div>
                    {!test ? (
                        <button onClick={createTest} className="btn-ghost w-full text-sm">
                            ＋ Создать тест
                        </button>
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