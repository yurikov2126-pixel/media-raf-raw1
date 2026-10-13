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
                <button type="button" aria-label={open ? "Свернуть вопрос" : "Редактировать вопрос"} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="text-white/80 text-xs mt-1 min-w-9 min-h-9">{open ? '▼' : '▶'}</button>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{index + 1}. {text}</div>
                    <div className="text-xs text-white/40 truncate">
                        {QUESTION_TYPES.find((x) => x.v === type)?.l || type} · {points} б.
                    </div>
                </div>
                <button type="button" aria-label="Удалить вопрос" onClick={onDelete} className="text-xs text-white/60 hover:text-pink min-w-9 min-h-9">✕</button>
            </div>
            {open && (
                <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_160px] gap-2">
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
function PayloadEditor({ type, payload, setPayload }) {
    const data = payload && typeof payload === 'object' ? payload : {};
    const update = (patch) => setPayload((previous) => ({ ...previous, ...patch }));
    const options = Array.isArray(data.options) ? data.options : [];
    const editList = (field, index, value) => update({
        [field]: (Array.isArray(data[field]) ? data[field] : []).map((item, i) => i === index ? value : item),
    });
    const lists = type === 'order' ? [{ key: 'items', label: 'Правильный порядок элементов' }]
        : type === 'matching' ? [{ key: 'left', label: 'Левая колонка' }, { key: 'right', label: 'Правая колонка' }] : [];
    if (type === 'single' || type === 'multiple') {
        const correct = type === 'multiple' ? (Array.isArray(data.correct) ? data.correct : []) : Number(data.correct ?? 0);
        return <div className="space-y-3">
            <p className="text-xs text-white/70">Заполните варианты и отметьте правильный ответ{type === 'multiple' ? ' или ответы' : ''}.</p>
            {options.map((option, i) => <div key={i} className="flex items-center gap-2">
                <input type={type === 'single' ? 'radio' : 'checkbox'} name={type === 'single' ? 'correct-' + String(options.length) + '-' + String(data._questionId || '') : undefined}
                    aria-label={`Вариант ${i + 1} правильный`}
                    checked={type === 'single' ? correct === i : correct.includes(i)}
                    onChange={() => update({ correct: type === 'single' ? i : correct.includes(i) ? correct.filter((v) => v !== i) : [...correct, i] })} />
                <input className="input flex-1 min-w-0" aria-label={`Вариант ${i + 1}`} value={option} onChange={(event) => editList('options', i, event.target.value)} />
                <button type="button" aria-label={`Удалить вариант ${i + 1}`} disabled={options.length <= 2} className="btn-ghost min-w-10 disabled:opacity-30"
                    onClick={() => {
                        const remaining = options.filter((_, j) => j !== i);
                        const indexes = type === 'multiple' ? correct.filter((v) => v !== i).map((v) => v > i ? v - 1 : v) : Math.max(0, correct > i ? correct - 1 : correct === i ? 0 : correct);
                        update({ options: remaining, correct: indexes });
                    }}>✕</button>
            </div>)}
            <button type="button" className="btn-ghost text-sm" onClick={() => update({ options: [...options, `Вариант ${options.length + 1}`] })}>＋ Добавить вариант</button>
        </div>;
    }
    if (type === 'text') return <div className="space-y-3">
        <label className="text-sm text-white/70 block">Правильный ответ
            <input className="input mt-1" value={data.answer || ''} onChange={(e) => update({ answer: e.target.value })} />
        </label>
        <label className="flex gap-2 items-center text-sm text-white/75">
            <input type="checkbox" checked={!!data.caseSensitive} onChange={(e) => update({ caseSensitive: e.target.checked })} /> Учитывать регистр букв
        </label>
    </div>;
    if (lists.length) return <div className="space-y-4">
        {lists.map(({ key, label }) => {
            const items = Array.isArray(data[key]) ? data[key] : [];
            return <section key={key} className="space-y-2">
                <h4 className="font-medium text-sm">{label}</h4>
                {items.map((item, i) => <div key={i} className="flex gap-2">
                    <input className="input min-w-0 flex-1" value={item} aria-label={`${label} ${i + 1}`} onChange={(e) => editList(key, i, e.target.value)} />
                    <button type="button" className="btn-ghost" aria-label="Удалить элемент" disabled={items.length <= 2}
                        onClick={() => update({ [key]: items.filter((_, j) => i !== j) })}>✕</button>
                </div>)}
                <button type="button" className="btn-ghost text-sm" onClick={() => update({ [key]: [...items, ''] })}>＋ Добавить элемент</button>
            </section>;
        })}
        {type === 'matching' && <section className="space-y-2">
            <h4 className="font-medium text-sm">Правильные соответствия</h4>
            {(Array.isArray(data.left) ? data.left : []).map((_, i) => {
                const pairs = Array.isArray(data.pairs) ? data.pairs : [];
                const target = pairs.find((pair) => pair[0] === i)?.[1] ?? i;
                return <label key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-8 shrink-0">{i + 1} →</span>
                    <select className="input flex-1 min-w-0" value={target} onChange={(e) => {
                        const rest = pairs.filter((pair) => pair[0] !== i);
                        update({ pairs: [...rest, [i, Number(e.target.value)]] });
                    }}>
                        {(Array.isArray(data.right) ? data.right : []).map((label, j) => <option key={j} value={j}>{j + 1}. {label}</option>)}
                    </select>
                </label>;
            })}
        </section>}
    </div>;
    return <p className="text-xs text-white/60">Выберите тип вопроса.</p>;
}
