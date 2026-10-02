import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';

export default function Push({ token, users, courses }) {
    const [stats, setStats] = useState({});
    const [subs, setSubs] = useState([]);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const [target, setTarget] = useState('all');
    const [direction, setDirection] = useState('photo');
    const [courseId, setCourseId] = useState('');
    const [group, setGroup] = useState('');
    const [groups, setGroups] = useState([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [url, setUrl] = useState('/app');

    const reload = async () => {
        try {
            const [s, list, g] = await Promise.all([
                api('/admin/push/stats', { token }),
                api('/admin/push/subscriptions', { token }),
                api('/admin/groups', { token }).catch(() => []),
            ]);
            setStats(s);
            setSubs(list);
            setGroups(g);
        } catch (e) { setError(e.message); }
    };

    useEffect(() => { reload(); /* eslint-disable-next-line */ }, [token]);

    const send = async () => {
        if (!title.trim() || !body.trim()) { setError('Заполните заголовок и текст'); return; }
        if (!confirm('Отправить push выбранным получателям?')) return;
        setBusy(true); setError(''); setResult(null);
        try {
            const payload = { target, title, body, url };
            if (target === 'direction') payload.direction = direction;
            if (target === 'course') payload.courseId = courseId;
            if (target === 'group') payload.group = group;
            const r = await api('/admin/push/send', { method: 'POST', token, body: payload });
            setResult(r);
            setTitle(''); setBody('');
            await reload();
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    const testSelf = async () => {
        setBusy(true); setError('');
        try {
            const r = await api('/admin/push/test-self', {
                method: 'POST',
                token,
                body: { title: 'Тест из админки', body: 'Push-сервис работает ✅' },
            });
            alert(`Отправлено: ${r.sent || 0}, ошибок: ${r.failed || 0}`);
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    return (
        <div className="space-y-4">
            <div className="card p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div>
                        <div className="font-bold text-lg">🔔 Push-уведомления</div>
                        <div className="text-sm text-white/50 mt-1">
                            Отправляются даже когда приложение закрыто. Требуется HTTPS и разрешение пользователя.
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={testSelf} disabled={busy} className="btn-ghost">🧪 Тест себе</button>
                        <button onClick={reload} disabled={busy} className="btn-ghost">🔄</button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="card p-4">
                        <div className="text-2xl font-bold">{stats.totalSubscriptions ?? '—'}</div>
                        <div className="text-xs text-white/50">Всего подписок</div>
                    </div>
                    <div className="card p-4">
                        <div className="text-2xl font-bold">{stats.uniqueUsers ?? '—'}</div>
                        <div className="text-xs text-white/50">Уникальных пользователей</div>
                    </div>
                    <div className="card p-4">
                        <div className="text-2xl font-bold">{stats.activeLast7Days ?? '—'}</div>
                        <div className="text-xs text-white/50">Активных за 7 дней</div>
                    </div>
                </div>
            </div>

            <div className="card p-5 space-y-3">
                <div className="font-bold">📣 Массовая рассылка</div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Кому</label>
                    <div className="flex flex-wrap gap-2">
                        {[['all', '👥 Всем'], ['direction', '🎯 По направлению'], ['course', '📚 По курсу'], ['group', '🎓 По группе']].map(([v, l]) => (
                            <button key={v} onClick={() => setTarget(v)} className={`chip ${target === v ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}>{l}</button>
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
                <input className="input" placeholder="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} />
                <textarea className="input resize-none" rows={3} placeholder="Текст уведомления" value={body} onChange={(e) => setBody(e.target.value)} />
                <input className="input" placeholder="URL (/app/chats/xxx)" value={url} onChange={(e) => setUrl(e.target.value)} />
                <button onClick={send} disabled={busy} className="btn-primary">
                    {busy ? 'Отправка…' : '🔔 Отправить push'}
                </button>
                {error && <div className="text-sm text-pink bg-pink/10 rounded-xl p-3">{error}</div>}
                {result && (
                    <div className="text-sm text-lime bg-lime/10 rounded-xl p-3">
                        ✓ Получателей: {result.recipients} · Доставлено: {result.sent} · Ошибок: {result.failed}
                        {result.gone > 0 && ` · Удалено мёртвых: ${result.gone}`}
                    </div>
                )}
            </div>

            <div className="card p-5">
                <div className="font-bold mb-3">📋 Активные подписки</div>
                {subs.length === 0 && <div className="text-center text-white/40 text-sm py-4">Пока никто не подписался</div>}
                <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                    {subs.map((s) => (
                        <div key={s.id} className="p-3 flex items-center gap-3 flex-wrap">
                            <div className="flex-1 min-w-[180px]">
                                <div className="font-semibold text-sm">{s.user.fullName}</div>
                                <div className="text-xs text-white/40 truncate font-mono">{s.endpoint}</div>
                            </div>
                            <div className="text-[10px] text-white/30">{new Date(s.lastUsed).toLocaleString('ru-RU')}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}