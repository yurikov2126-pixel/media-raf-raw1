import { useEffect, useState } from 'react';
import { api } from '../../../../api/client.js';
import SearchSelect from '../../components/SearchSelect.jsx';

export default function BulkCourseAction({ token, courses, onResult }) {
    const [courseId, setCourseId] = useState('');
    const [target, setTarget] = useState('all');
    const [direction, setDirection] = useState('photo');
    const [group, setGroup] = useState('');
    const [groups, setGroups] = useState([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api('/admin/groups', { token }).then(setGroups).catch(() => {});
    }, [token]);

    const run = async (endpoint, label) => {
        if (!courseId) return alert('Выберите курс');
        if (!confirm(`${label}\n\nПродолжить?`)) return;
        setBusy(endpoint);
        try {
            const body = { courseId, target };
            if (target === 'direction') body.direction = direction;
            if (target === 'group') body.group = group;
            const r = await api(endpoint, { method: 'POST', token, body });
            onResult?.(r, endpoint);
        } catch (e) { alert(e.message); }
        finally { setBusy(null); }
    };

    return (
        <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-2">
                <SearchSelect
                    items={courses.map((c) => ({ id: c.id, label: c.title, sub: c.slug }))}
                    value={courseId}
                    onChange={setCourseId}
                    placeholder="Курс…"
                />
                <div className="flex flex-wrap gap-2 items-center">
                    {[['all', '👥 Всем'], ['direction', '🎯 По направлению'], ['group', '🎓 По группе']].map(([v, l]) => (
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
            {target === 'group' && (
                <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
                    <option value="">— выберите группу —</option>
                    {groups.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
            )}
            <div className="grid sm:grid-cols-3 gap-2">
                <button onClick={() => run('/admin/bulk/enroll', 'Массово записать выбранных на курс?')} disabled={busy === '/admin/bulk/enroll'} className="btn-ghost">
                    {busy === '/admin/bulk/enroll' ? '⏳…' : '＋ Записать'}
                </button>
                <button onClick={() => run('/admin/bulk/unenroll', 'Отчислить выбранных с курса?')} disabled={busy === '/admin/bulk/unenroll'} className="btn-ghost">
                    {busy === '/admin/bulk/unenroll' ? '⏳…' : '✕ Отчислить'}
                </button>
                <button onClick={() => run('/admin/bulk/reset-progress', 'Обнулить прогресс выбранных?')} disabled={busy === '/admin/bulk/reset-progress'} className="btn-ghost text-pink">
                    {busy === '/admin/bulk/reset-progress' ? '⏳…' : '↺ Обнулить прогресс'}
                </button>
            </div>
        </div>
    );
}