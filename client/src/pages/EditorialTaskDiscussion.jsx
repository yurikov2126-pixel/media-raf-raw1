import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function EditorialTaskDiscussion({ projectId, task, token, canEdit, userId, onError, onChanged }) {
    const [data, setData] = useState({ comments: [], events: [], applications: [] });
    const [comment, setComment] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const base = `/editorial/workflow/projects/${projectId}/tasks/${task.id}`;
    async function reload() {
        const result = await api(base + '/discussion', { token });
        setData(result);
    }
    useEffect(() => {
        let active = true;
        setLoading(true);
        api(base + '/discussion', { token }).then((result) => { if (active) setData(result); })
            .catch((e) => { if (active) onError(e.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [base, token]);
    async function perform(callback) {
        if (busy) return;
        setBusy(true); onError('');
        try { await callback(); await reload(); await onChanged?.(); }
        catch (e) { onError(e.message); }
        finally { setBusy(false); }
    }
    const ownApplication = data.applications.find((a) => a.userId === userId);
    return <div className="space-y-5 border-t border-current/10 pt-4">
        {canEdit && <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!task.isOpen} disabled={busy || !!task.assigneeId} onChange={(e) => perform(() => api(base, { method: 'PATCH', token, body: { isOpen: e.target.checked } }))} />
            Открыть приём заявок на задачу
        </label>}
        {task.isOpen && !task.assigneeId && !canEdit && <form onSubmit={(e) => { e.preventDefault(); perform(async () => { await api(base + '/applications', { method: 'POST', token, body: { note } }); setNote(''); }); }} className="space-y-2">
            <h6 className="font-semibold">Откликнуться на задачу</h6>
            <textarea value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Коротко о вашем участии (необязательно)" className="w-full rounded-lg border border-current/20 bg-transparent p-2 text-sm" />
            <button disabled={busy || ownApplication?.status === 'PENDING'} className="rounded-lg border border-current/30 px-3 py-2 text-sm disabled:opacity-50">{ownApplication?.status === 'PENDING' ? 'Заявка ожидает решения' : 'Подать заявку'}</button>
        </form>}
        {canEdit && data.applications.length > 0 && <div className="space-y-2">
            <h6 className="font-semibold">Заявки ({data.applications.length})</h6>
            {data.applications.map((a) => <div key={a.id} className="rounded-lg border border-current/10 p-3 text-sm">
                <p className="font-medium">{a.user?.fullName || a.userId} · {a.status === 'PENDING' ? 'Ожидает решения' : a.status === 'APPROVED' ? 'Одобрена' : 'Отклонена'}</p>
                {a.note && <p className="mt-1 whitespace-pre-wrap break-words opacity-70">{a.note}</p>}
                {a.status === 'PENDING' && <div className="mt-2 flex gap-2">
                    <button disabled={busy} onClick={() => perform(() => api(base + '/applications/' + a.id, { method: 'PATCH', token, body: { status: 'APPROVED' } }))} className="rounded-lg border border-current/30 px-3 py-1">Принять</button>
                    <button disabled={busy} onClick={() => perform(() => api(base + '/applications/' + a.id, { method: 'PATCH', token, body: { status: 'REJECTED' } }))} className="rounded-lg border border-current/30 px-3 py-1">Отклонить</button>
                </div>}
            </div>)}
        </div>}
        {!canEdit && ownApplication && <p className="text-sm opacity-70">Моя заявка: {ownApplication.status === 'PENDING' ? 'ожидает решения' : ownApplication.status === 'APPROVED' ? 'одобрена' : 'отклонена'}</p>}
        <div className="space-y-2">
            <h6 className="font-semibold">Обсуждение ({data.comments.length})</h6>
            {loading ? <p role="status" className="text-sm opacity-60">Загружаем обсуждение…</p> : data.comments.length === 0 ? <p className="text-sm opacity-60">Комментариев пока нет.</p> : data.comments.map((c) => <div key={c.id} className="rounded-lg border border-current/10 p-3 text-sm">
                <p className="text-xs opacity-60">{c.author?.fullName || 'Участник'} · {new Date(c.createdAt).toLocaleString('ru-RU')}</p>
                <p className="mt-1 whitespace-pre-wrap break-words">{c.body}</p>
            </div>)}
            <form onSubmit={(e) => { e.preventDefault(); perform(async () => { await api(base + '/comments', { method: 'POST', token, body: { body: comment } }); setComment(''); }); }} className="space-y-2">
                <textarea required maxLength={4000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Написать комментарий…" rows={3} className="w-full rounded-lg border border-current/20 bg-transparent p-2 text-sm" />
                <button disabled={busy || !comment.trim()} className="rounded-lg border border-current/30 px-3 py-2 text-sm disabled:opacity-50">Отправить комментарий</button>
            </form>
        </div>
        <details className="rounded-lg border border-current/10 p-3">
            <summary className="cursor-pointer text-sm font-semibold">История действий ({data.events.length})</summary>
            <div className="mt-3 space-y-2">{data.events.map((event) => <p key={event.id} className="break-words text-xs opacity-70">{new Date(event.createdAt).toLocaleString('ru-RU')} · {event.actor?.fullName || 'Участник'} · {({ CREATED: 'Создание', UPDATED: 'Изменение', COMMENTED: 'Комментарий', APPLIED: 'Заявка', APPLICATION_APPROVED: 'Заявка принята', APPLICATION_REJECTED: 'Заявка отклонена' })[event.action] || event.action}</p>)}</div>
        </details>
    </div>;
}
