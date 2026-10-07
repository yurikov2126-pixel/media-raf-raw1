import { useState } from 'react';
import { QUESTION_TYPES } from '../../constants.js';
import { useToast } from '../../../../store/toast.jsx';

function defaultPayload(type, old = {}) {
    if (type === 'single') return { options: old.options || ['Вариант 1', 'Вариант 2'], correct: 0 };
    if (type === 'multiple') return { options: old.options || ['Вариант 1', 'Вариант 2'], correct: [] };
    if (type === 'matching') return { left: old.left || ['A', 'B'], right: old.right || ['1', '2'], pairs: old.pairs || [[0, 0], [1, 1]] };
    if (type === 'text') return { answer: old.answer || '', caseSensitive: old.caseSensitive ?? false };
    if (type === 'order') return { items: old.items || ['Первый', 'Второй', 'Третий'] };
    return {};
}

export default function QuestionEditor({ question, index, onUpdate, onDelete }) {
    const toast = useToast();
    const [type, setType] = useState(question.type || 'single');
    const [text, setText] = useState(question.text);
    const [payload, setPayload] = useState(() => {
        try { return JSON.parse(question.payload || '{}'); } catch { return {}; }
    });
    const [points, setPoints] = useState(question.points);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            await onUpdate({ type, text, payload, points: Number(points) || 1 });
        } catch (e) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const changeType = (newType) => {
        setType(newType);
        setPayload(defaultPayload(newType, payload));
    };

    return (
        <div className="card p-3">
            <div className="flex items-start gap-2">
                <button onClick={() => setOpen((o) => !o)} className="text-white/50 text-xs mt-1">{open ? '▼' : '▶'}</button>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{index + 1}. {text}</div>
                    <div className="text-xs text-white/40 truncate">
                        {QUESTION_TYPES.find((x) => x.v === type)?.l || type} · {points} б.
                    </div>
                </div>
                <button onClick={onDelete} className="text-xs text-white/40 hover:text-pink">✕</button>
            </div>
            {open && (
                <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-[1fr_110px] gap-2">
                        <textarea rows={2} className="input resize-none text-sm" value={text} onChange={(e) => setText(e.target.value)} />
                        <div className="flex flex-col gap-2">
                            <select className="input !py-2 text-sm" value={type} onChange={(e) => changeType(e.target.value)}>
                                {QUESTION_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                            </select>
                            <input type="number" className="input !py-2 text-sm" value={points} onChange={(e) => setPoints(e.target.value)} />
                        </div>
                    </div>
                    <PayloadEditor type={type} payload={payload} setPayload={setPayload} />
                    <button onClick={save} disabled={saving} className="chip bg-violet text-white text-xs">
                        {saving ? '…' : 'Сохранить'}
                    </button>
                </div>
            )}
        </div>
    );
}