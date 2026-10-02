import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';

export default function Broadcast({ token, users, courses }) {
    const [target, setTarget] = useState('all');
    const [direction, setDirection] = useState('photo');
    const [courseId, setCourseId] = useState('');
    const [group, setGroup] = useState('');
    const [groups, setGroups] = useState([]);
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        api('/admin/groups', { token }).then(setGroups).catch(() => {});
    }, [token]);

    const preview = (() => {
        if (target === 'all') return `${users.length} получателей`;
        if (target === 'direction') {
            const cnt = users.filter((u) => u.direction === direction).length;
            return `${cnt} получателей с направлением «${direction}»`;
        }
        if (target === 'course') {
            if (!courseId) return 'Выберите курс';
            const c = courses.find((x) => x.id === courseId);
            return `Все записанные на курс «${c?.title || ''}»`;
        }
        if (target === 'group') {
            if (!group) return 'Выберите группу';
            return `Группа «${group}»`;
        }
        return '';
    })();

    const send = async () => {
        if (!message.trim()) return alert('Введите текст');
        if (!confirm('Отправить рассылку?')) return;
        setBusy(true);
        setResult(null);
        try {
            const body = { target, message, title };
            if (target === 'direction') body.direction = direction;
            if (target === 'course') body.courseId = courseId;
            if (target === 'group') body.group = group;
            const r = await api('/admin/broadcast', { method: 'POST', token, body });
            setResult(r);
            setMessage('');
            setTitle('');
        } catch (e) { alert(e.message); }
        finally { setBusy(false); }
    };

    return (
        <div className="grid md:grid-cols-2 gap-5">
            <div className="card p-5 space-y-3">
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Кому</label>
                    <div className="flex flex-wrap gap-2">
                        {[['all', '👥 Всем'], ['direction', '🎯 По направлению'], ['course', '📚 По курсу'], ['group', '🎓 По группе']].map(([v, l]) => (
                            <button
                                key={v}
                                onClick={() => setTarget(v)}
                                className={`chip ${target === v ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>
                {target === 'direction' && (
                    <select className="input" value={direction} onChange={(e) => setDirection(e.target.value)}>
                        <option value="photo">📸 Фото</option>
                        <option value="video">🎥 Видео</option>
                        <option value="radio">📻 Радио</option>
                        <option value="sound">🎚️ Звук</option>
                    </select>
                )}
                {target === 'course' && (
                    <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                        <option value="">— выберите курс —</option>
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                )}
                {target === 'group' && (
                    <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
                        <option value="">— выберите группу —</option>
                        {groups.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                )}
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Заголовок</label>
                    <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Сообщение от администрации" />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Текст</label>
                    <textarea rows={5} className="input resize-none" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Текст рассылки…" />
                </div>
                <div className="text-xs text-white/50">Получатели: {preview}</div>
                <button onClick={send} disabled={busy} className="btn-primary w-full">
                    {busy ? 'Отправка…' : '📢 Отправить рассылку'}
                </button>
                {result && <div className="card p-3 text-sm text-lime bg-lime/10">✓ Доставлено {result.delivered} получателям</div>}
            </div>
            <div className="card p-5">
                <div className="text-xs text-white/40 uppercase mb-2">Как выглядит</div>
                <div className="rounded-2xl bg-ink-700/70 p-4 border border-white/5">
                    <div className="text-sm font-bold mb-1">📢 {title || 'Сообщение от администрации'}</div>
                    <div className="text-sm text-white/80 whitespace-pre-wrap">{message || 'Здесь будет текст…'}</div>
                </div>
            </div>
        </div>
    );
}