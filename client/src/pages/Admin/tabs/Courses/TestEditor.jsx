import { useState } from 'react';
import { api } from '../../../../api/client.js';
import QuestionEditor from './QuestionEditor.jsx';

export default function TestEditor({ test, setTest, token, onDelete }) {
    const [title, setTitle] = useState(test.title);
    const [passScore, setPassScore] = useState(test.passScore);
    const [questions, setQuestions] = useState(test.questions || []);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const saveMeta = async () => {
        setBusy(true);
        setError('');
        try {
        await api(`/admin/tests/${test.id}`, {
            method: 'PATCH',
            token,
            body: { title, passScore: Number(passScore) || 70 },
        });
        } catch (e) { setError(e.message || "Не удалось сохранить тест"); }
        finally { setBusy(false); }
    };

    const addQuestion = async () => {
        setError('');
        try {
        const q = await api(`/admin/tests/${test.id}/questions`, {
            method: 'POST',
            token,
            body: { type: 'single', text: 'Новый вопрос', payload: { options: ['Вариант 1', 'Вариант 2'], correct: 0 }, points: 1 },
        });
        setQuestions((prev) => [...prev, q]);
        } catch (e) { setError(e.message || "Не удалось добавить вопрос"); }
    };

    const updateQuestion = async (id, patch) => {
        const updated = await api(`/admin/questions/${id}`, { method: 'PATCH', token, body: patch });
        setQuestions((prev) => prev.map((q) => (q.id === id ? updated : q)));
    };

    const removeQuestion = async (id) => {
        if (!confirm('Удалить вопрос?')) return;
        try {
            await api(`/admin/questions/${id}`, { method: 'DELETE', token });
            setQuestions((prev) => prev.filter((q) => q.id !== id));
        } catch (e) { setError(e.message || "Не удалось удалить вопрос"); }
    };

    return (
        <div className="space-y-3 min-w-0">
            {error && <div role="alert" className="p-3 rounded-lg bg-red-500/10 text-red-300 text-sm">{error}</div>}
            <div className="flex items-center justify-between">
                <div className="font-bold">🎯 Тест</div>
                <button onClick={onDelete} className="chip bg-white/5 hover:bg-pink/30 text-xs">Удалить тест</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_120px] gap-2">
                <input aria-label="Название теста" className="input min-w-0" value={title} onChange={(e) => setTitle(e.target.value)} />
                <input aria-label="Проходной балл, процентов" min="1" max="100" type="number" className="input" value={passScore} onChange={(e) => setPassScore(e.target.value)} />
            </div>
            <button onClick={saveMeta} disabled={busy} className="btn-ghost w-full min-h-11 text-sm disabled:opacity-50">Сохранить тест</button>

            <div className="flex items-center justify-between pt-2">
                <div className="text-sm font-bold">Вопросы ({questions.length})</div>
                <button onClick={addQuestion} className="chip bg-violet/30 hover:bg-violet/50 text-xs">＋ Вопрос</button>
            </div>

            <div className="space-y-3 pr-1">
                {questions.map((q, i) => (
                    <QuestionEditor
                        key={q.id}
                        index={i}
                        question={q}
                        onUpdate={(patch) => updateQuestion(q.id, patch)}
                        onDelete={() => removeQuestion(q.id)}
                    />
                ))}
                {questions.length === 0 && <div className="text-center text-white/40 text-sm py-3">Вопросов нет</div>}
            </div>
        </div>
    );
}