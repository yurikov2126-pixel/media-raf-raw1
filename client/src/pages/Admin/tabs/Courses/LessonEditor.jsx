import { useState } from 'react';
import { api } from '../../../../api/client.js';
import TestEditor from './TestEditor.jsx';

export default function LessonEditor({ lesson, token, onSaved, onDeleted }) {
    const [form, setForm] = useState({
        title: lesson.title,
        content: lesson.content || '',
        videoUrl: lesson.videoUrl || '',
        order: lesson.order ?? 0,
        duration: lesson.duration ?? 0,
    });
    const [test, setTest] = useState(lesson.test || null);
    const [busy, setBusy] = useState(false);

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
        } catch (e) { alert(e.message); }
        finally { setBusy(false); }
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
        <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="font-bold">Урок</div>
                <button onClick={remove} className="chip bg-white/5 hover:bg-pink/30 text-xs">🗑️</button>
            </div>
            <input className="input" value={form.title} onChange={set('title')} placeholder="Название" />
            <textarea rows={5} className="input resize-none" value={form.content} onChange={set('content')} placeholder="Содержимое" />
            <input className="input" value={form.videoUrl} onChange={set('videoUrl')} placeholder="URL видео" />
            <div className="grid grid-cols-2 gap-2">
                <input type="number" className="input" value={form.order} onChange={set('order')} placeholder="Порядок" />
                <input type="number" className="input" value={form.duration} onChange={set('duration')} placeholder="Длительность (мин)" />
            </div>
            <button onClick={save} disabled={busy} className="btn-primary w-full">
                {busy ? 'Сохранение…' : 'Сохранить урок'}
            </button>
            <div className="pt-3 border-t border-white/10">
                {!test ? (
                    <button onClick={createTest} className="btn-ghost w-full text-sm">＋ Создать тест</button>
                ) : (
                    <TestEditor test={test} setTest={setTest} token={token} onDelete={deleteTest} />
                )}
            </div>
        </div>
    );
}