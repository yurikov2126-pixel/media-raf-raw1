import { useEffect, useState } from 'react';
import { api, resolveUrl } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import FileUploader from './FileUploader.jsx';

export const readRubric = (raw) => {
    if (Array.isArray(raw)) return raw;
    try { const value = JSON.parse(raw || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
};

export function LearningRubric({ kind, workId, rubric, studentId, editable = false, onChange, onScoresChange }) {
    const { token } = useAuth();
    const [criteria, setCriteria] = useState(() => readRubric(rubric));
    const [scores, setScores] = useState([]);
    const [history, setHistory] = useState([]);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => { setCriteria(readRubric(rubric)); setScores([]); }, [rubric, workId]);
    useEffect(() => {
        if (!studentId) return;
        let live = true;
        api(`/learning-collaboration/${kind}/${encodeURIComponent(workId)}/${encodeURIComponent(studentId)}/grades`, { token })
            .then(data => { if (live) setHistory(data); }).catch(() => {});
        return () => { live = false; };
    }, [studentId, kind, workId, token]);
    const changeScore = (index, score) => {
        const next = [...scores];
        next[index] = { score: score === '' ? '' : Number(score) };
        setScores(next);
        onScoresChange?.(next);
    };
    const save = async () => {
        setSaving(true); setError('');
        try {
            const data = await api(`/learning-collaboration/${kind}/${encodeURIComponent(workId)}/rubric`, {
                token, method: 'PUT', body: { criteria },
            });
            setCriteria(data.criteria);
            onChange?.(JSON.stringify(data.criteria));
            setEditing(false);
        } catch (e) { setError(e.message || 'Не удалось сохранить критерии'); }
        finally { setSaving(false); }
    };
    const max = criteria.reduce((n, c) => n + Number(c.max || 0), 0);
    const gained = criteria.reduce((n, c, i) => n + Number(scores[i]?.score || 0), 0);
    return <section className="rounded-xl bg-violet-soft/5 border border-violet-soft/20 p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm">Критерии оценивания</h3>
            {editable && <button className="btn-ghost text-xs min-h-9" onClick={() => setEditing(v => !v)} type="button">
                {editing ? 'Отмена' : 'Настроить'}
            </button>}
        </div>
        {!criteria.length && !editing && <p className="text-sm text-white/60">Критерии пока не заданы. Используется общая оценка.</p>}
        {editing ? <>
            {criteria.map((c, index) => <div className="flex flex-wrap gap-2" key={index}>
                <input className="input min-w-0 flex-1 text-sm" value={c.title} aria-label="Название критерия"
                    onChange={e => setCriteria(v => v.map((item, i) => i === index ? {...item,title:e.target.value} : item))}/>
                <input className="input w-20 text-sm" type="number" min="1" max="5" value={c.max}
                    aria-label="Максимум баллов" onChange={e => setCriteria(v => v.map((item,i) => i === index ? {...item,max:Number(e.target.value)}:item))}/>
                <button className="btn-ghost text-sm" onClick={() => setCriteria(v => v.filter((_,i)=>i!==index))} aria-label="Удалить критерий">✕</button>
            </div>)}
            <div className="flex gap-2 flex-wrap">
                <button className="btn-ghost text-xs" disabled={criteria.length >= 10} onClick={() => setCriteria(v=>[...v,{title:'',max:5}])}>+ Критерий</button>
                <button className="btn-primary text-xs" disabled={saving} onClick={save}>{saving ? 'Сохраняем…' : 'Сохранить критерии'}</button>
            </div>
        </> : criteria.map((c,i)=><div key={i} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 break-words text-white/85">{c.title} <span className="text-white/50">(макс. {c.max})</span></span>
            {editable && onScoresChange && <input type="number" min="0" max={c.max} step="1"
                className="input w-20 shrink-0 text-sm" placeholder="Балл" value={scores[i]?.score ?? ''}
                aria-label={`Балл: ${c.title}`} onChange={e=>changeScore(i,e.target.value)}/>}
        </div>)}
        {editable && !!criteria.length && onScoresChange && <div className="text-xs text-white/70">
            Набрано {gained}/{max} баллов · Итоговая оценка: {Math.max(1,Math.round(5*gained/Math.max(1,max)))}/5. Заполните каждый критерий перед принятием.
        </div>}
        {!!history.length && <details className="text-sm text-white/80 border-t border-white/10 pt-2">
            <summary className="cursor-pointer">Предыдущие оценки по критериям ({history.length})</summary>
            {history.map(result => <div key={result.id} className="mt-2 rounded-lg bg-white/5 p-3">
                <div className="text-xs text-white/60 mb-2">{new Date(result.createdAt).toLocaleString('ru-RU')}</div>
                {result.criteria.map((criterion,index) => <div key={index} className="flex justify-between gap-2 py-1">
                    <span className="break-words">{criterion.title}</span>
                    <span className="shrink-0">{criterion.score}/{criterion.max}</span>
                </div>)}
            </div>)}
        </details>}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </section>;
}

export function LearningDiscussion({ kind, workId, studentId }) {
    const { token } = useAuth();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const endpoint = `/learning-collaboration/${kind}/${encodeURIComponent(workId)}/${encodeURIComponent(studentId)}/messages`;
    useEffect(() => {
        if (!open || !studentId) return;
        let live = true; setLoading(true); setError('');
        api(endpoint, { token }).then(r => { if(live) setMessages(r); })
            .catch(e=>{if(live)setError(e.message);})
            .finally(()=>{if(live)setLoading(false);});
        return ()=>{live=false;};
    }, [open, endpoint, token, studentId]);
    const send = async () => {
        if (sending || uploading || (!text.trim() && !files.length)) return;
        setSending(true); setError('');
        try {
            const result = await api(endpoint, { token, method: 'POST', body: { text, files } });
            setMessages(old => [...old, result]); setText(''); setFiles([]);
        } catch (e) { setError(e.message || 'Не удалось отправить сообщение'); }
        finally { setSending(false); }
    };
    if (!studentId) return null;
    return <section className="border border-white/10 rounded-xl p-3 space-y-3">
        <button type="button" className="font-semibold text-sm text-violet-soft w-full text-left min-h-10"
            aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open ? '▾' : '▸'} Обсуждение работы</button>
        {open && <>
            {loading && <p className="text-white/60 text-sm" role="status">Загружаем переписку…</p>}
            {!loading && !messages.length && <p className="text-white/60 text-sm">Пока нет комментариев. Можно задать вопрос по работе.</p>}
            <div className="space-y-2 max-h-80 overflow-y-auto" aria-live="polite">
                {messages.map(m => <article key={m.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="flex justify-between flex-wrap gap-1 text-xs text-white/60 mb-1">
                        <span>{m.author?.fullName || 'Участник'}{m.version ? ` · версия ${m.version}` : ''}</span>
                        <time>{new Date(m.createdAt).toLocaleString('ru-RU')}</time>
                    </div>
                    <p className="text-sm text-white/90 whitespace-pre-wrap break-words">{m.text}</p>
                    {!!m.files?.length && <div className="flex flex-wrap gap-2 mt-2">
                        {m.files.map((f,i)=><a key={i} href={resolveUrl(f.url)} target="_blank" rel="noreferrer"
                            className="text-xs text-violet-soft underline break-all">📎 {f.name}</a>)}
                    </div>}
                </article>)}
            </div>
            <label className="text-xs text-white/70 block">Новое сообщение</label>
            <textarea className="input w-full text-sm" rows={3} maxLength={4000} value={text}
                onChange={e=>setText(e.target.value)} placeholder="Вопрос, ответ или замечание по работе…"/>
            <FileUploader files={files} onChange={setFiles} maxFiles={5} maxSizeMb={50} onBusyChange={setUploading}/>
            <button className="btn-primary text-sm min-h-11" disabled={sending||uploading||(!text.trim()&&!files.length)}
                onClick={send}>{sending ? 'Отправляем…' : 'Отправить сообщение'}</button>
            {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
        </>}
    </section>;
}
