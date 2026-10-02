import { useState } from 'react';
import { api } from '../../../../api/client.js';
import QuestionEditor from './QuestionEditor.jsx';

export default function TestEditor({ test, setTest, token, onDelete }) {
    const [title, setTitle] = useState(test.title);
    const [passScore, setPassScore] = useState(test.passScore);
    const [questions, setQuestions] = useState(test.questions || []);

    const saveMeta = async () => {
        await api(`/admin/tests/${test.id}`, {
            method: 'PATCH',
            token,
            body: { title, passScore: Number(passScore) || 70 },
        });
    };

    const addQuestion = async () => {
        const q = await api(`/admin/tests/${test.id}/questions`, {
            method: 'POST',
            token,
            body: { type: 'single', text: 'Новый вопрос', payload: { options: ['Вариант 1', 'Вариант 2'], correct: 0 }, points: 1 },
        });
        setQuestions((prev) => [...prev, q]);
    };

    const updateQuestion = async (id, patch) => {
        const updated = await api(`/admin/questions/${id}`, { method: 'PATCH', token, body: patch });
        setQuestions((prev) => prev.map((q) => (q.id === id ? updated : q)));
    };

    const removeQuestion = async (id) => {
        if (!confirm('Удалить вопрос?')) return;
        await api(`/admin/questions/${id}`, { method: 'DELETE', token });
        setQuestions((prev) => prev.filter((q) => q.id !== id));
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="font-bold">🎯 Тест</div>
                <button onClick={onDelete} className="chip bg-white/5 hover:bg-pink/30 text-xs">Удалить тест</button>
            </div>
            <div className="grid grid-cols-[1fr_80px] gap-2">
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
                <input type="number" className="input" value={passScore} onChange={(e) => setPassScore(e.target.value)} />
            </div>
            <button onClick={saveMeta} className="btn-ghost w-full text-sm">Сохранить тест</button>

            <div className="flex items-center justify-between pt-2">
                <div className="text-sm font-bold">Вопросы ({questions.length})</div>
                <button onClick={addQuestion} className="chip bg-violet/30 hover:bg-violet/50 text-xs">＋ Вопрос</button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
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