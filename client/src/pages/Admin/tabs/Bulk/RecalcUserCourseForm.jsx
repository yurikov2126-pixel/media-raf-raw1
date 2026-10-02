import { useState } from 'react';
import { api } from '../../../../api/client.js';
import SearchSelect from '../../components/SearchSelect.jsx';

export default function RecalcUserCourseForm({ token, users, courses }) {
    const [userId, setUserId] = useState('');
    const [courseId, setCourseId] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);

    const run = async () => {
        if (!userId || !courseId) return alert('Выберите студента и курс');
        setBusy(true); setResult(null);
        try {
            const r = await api('/admin/bulk/recalc-user-course', { method: 'POST', token, body: { userId, courseId } });
            setResult(r);
        } catch (e) { alert(e.message); }
        finally { setBusy(false); }
    };

    return (
        <div className="mt-3 grid md:grid-cols-3 gap-2 items-end">
            <SearchSelect
                items={users.map((u) => ({ id: u.id, label: u.fullName, sub: `@${u.username}` }))}
                value={userId}
                onChange={setUserId}
                placeholder="Студент…"
            />
            <SearchSelect
                items={courses.map((c) => ({ id: c.id, label: c.title, sub: c.slug }))}
                value={courseId}
                onChange={setCourseId}
                placeholder="Курс…"
            />
            <button onClick={run} disabled={busy} className="btn-ghost">{busy ? '⏳…' : '↺ Пересчитать'}</button>
            {result && <div className="text-xs text-lime md:col-span-3">Прогресс: {result.progress}%</div>}
        </div>
    );
}