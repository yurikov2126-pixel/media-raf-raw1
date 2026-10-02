import { useState } from 'react';
import { QUESTION_TYPES } from '../../constants.js';

function defaultPayload(type, old = {}) {
    if (type === 'single') return { options: old.options || ['Вариант 1', 'Вариант 2'], correct: 0 };
    if (type === 'multiple') return { options: old.options || ['Вариант 1', 'Вариант 2'], correct: [] };
    if (type === 'matching') return { left: old.left || ['A', 'B'], right: old.right || ['1', '2'], pairs: old.pairs || [[0, 0], [1, 1]] };
    if (type === 'text') return { answer: old.answer || '', caseSensitive: old.caseSensitive ?? false };
    if (type === 'order') return { items: old.items || ['Первый', 'Второй', 'Третий'] };
    return {};
}

export default function QuestionEditor({ question, index, onUpdate, onDelete }) {
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
        try { await onUpdate({ type, text, payload, points: Number(points) || 1 }); }
        catch (e) { alert(e.message); }
        finally { setSaving(false); }
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

/* ─── PayloadEditor ─── */

function PayloadEditor({ type, payload, setPayload }) {
    const set = (k, v) => setPayload({ ...payload, [k]: v });

    if (type === 'single') {
        const opts = payload.options || [];
        return (
            <div className="space-y-2">
                {opts.map((o, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                        <input type="radio" checked={payload.correct === idx} onChange={() => set('correct', idx)} />
                        <input className="input !py-2 text-sm" value={o} onChange={(e) => set('options', opts.map((x, i) => (i === idx ? e.target.value : x)))} />
                        {opts.length > 2 && <button onClick={() => set('options', opts.filter((_, i) => i !== idx))} className="text-white/40 hover:text-pink">✕</button>}
                    </div>
                ))}
                <button onClick={() => set('options', [...opts, `Вариант ${opts.length + 1}`])} className="chip bg-white/5 text-xs">＋ Вариант</button>
            </div>
        );
    }
    if (type === 'multiple') {
        const opts = payload.options || [];
        const cur = Array.isArray(payload.correct) ? payload.correct : [];
        const toggle = (idx) => set('correct', cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx]);
        return (
            <div className="space-y-2">
                {opts.map((o, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                        <input type="checkbox" checked={cur.includes(idx)} onChange={() => toggle(idx)} />
                        <input className="input !py-2 text-sm" value={o} onChange={(e) => set('options', opts.map((x, i) => (i === idx ? e.target.value : x)))} />
                        {opts.length > 2 && <button onClick={() => set('options', opts.filter((_, i) => i !== idx))} className="text-white/40 hover:text-pink">✕</button>}
                    </div>
                ))}
                <button onClick={() => set('options', [...opts, `Вариант ${opts.length + 1}`])} className="chip bg-white/5 text-xs">＋ Вариант</button>
            </div>
        );
    }
    if (type === 'matching') {
        const left = payload.left || [];
        const right = payload.right || [];
        const pairs = payload.pairs || [];
        return (
            <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <div className="text-xs text-white/40 mb-1">Левый столбец</div>
                        {left.map((l, i) => (
                            <input key={i} className="input !py-2 text-sm mb-1" value={l} onChange={(e) => set('left', left.map((x, j) => (j === i ? e.target.value : x)))} />
                        ))}
                        <button onClick={() => set('left', [...left, 'Новый'])} className="chip bg-white/5 text-xs">＋</button>
                    </div>
                    <div>
                        <div className="text-xs text-white/40 mb-1">Правый столбец</div>
                        {right.map((r, i) => (
                            <input key={i} className="input !py-2 text-sm mb-1" value={r} onChange={(e) => set('right', right.map((x, j) => (j === i ? e.target.value : x)))} />
                        ))}
                        <button onClick={() => set('right', [...right, 'Новый'])} className="chip bg-white/5 text-xs">＋</button>
                    </div>
                </div>
                {left.map((_, li) => {
                    const pair = pairs.find((p) => p[0] === li);
                    const val = pair ? pair[1] : '';
                    return (
                        <div key={li} className="flex gap-2 items-center">
                            <span className="text-xs w-6">{li + 1}</span>
                            <select className="input !py-2 text-sm" value={val} onChange={(e) => {
                                const v = e.target.value === '' ? null : Number(e.target.value);
                                const others = pairs.filter((p) => p[0] !== li);
                                set('pairs', v === null ? others : [...others, [li, v]]);
                            }}>
                                <option value="">—</option>
                                {right.map((_, ri) => <option key={ri} value={ri}>{ri + 1}</option>)}
                            </select>
                        </div>
                    );
                })}
            </div>
        );
    }
    if (type === 'text') {
        return (
            <div className="space-y-2">
                <input className="input !py-2 text-sm" placeholder="Правильный ответ" value={payload.answer || ''} onChange={(e) => set('answer', e.target.value)} />
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!payload.caseSensitive} onChange={(e) => set('caseSensitive', e.target.checked)} />
                    Учитывать регистр
                </label>
            </div>
        );
    }
    if (type === 'order') {
        const items = payload.items || [];
        const move = (i, dir) => {
            const arr = [...items]; const j = i + dir;
            if (j < 0 || j >= arr.length) return;
            [arr[i], arr[j]] = [arr[j], arr[i]];
            set('items', arr);
        };
        return (
            <div className="space-y-1">
                <div className="text-xs text-white/40 mb-1">Правильный порядок (сверху вниз)</div>
                {items.map((it, i) => (
                    <div key={i} className="flex gap-2 items-center">
                        <input className="input !py-2 text-sm flex-1" value={it} onChange={(e) => set('items', items.map((x, j) => (j === i ? e.target.value : x)))} />
                        <button onClick={() => move(i, -1)} className="btn-ghost !p-1 text-xs">↑</button>
                        <button onClick={() => move(i, 1)} className="btn-ghost !p-1 text-xs">↓</button>
                        {items.length > 2 && <button onClick={() => set('items', items.filter((_, j) => j !== i))} className="text-white/40 hover:text-pink">✕</button>}
                    </div>
                ))}
                <button onClick={() => set('items', [...items, `Пункт ${items.length + 1}`])} className="chip bg-white/5 text-xs">＋ Пункт</button>
            </div>
        );
    }
    return null;
}