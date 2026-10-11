import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const roleNames = { LEAD_PHOTO: 'Основной фотограф', ADDITIONAL_PHOTO: 'Дополнительный фотограф', LEAD_VIDEO: 'Видеорепортёр', VIDEO_EDITOR: 'Монтажёр', GIMBAL: 'Оператор стабилизатора', ACTION_CAMERA: 'Оператор экшн-камеры', SOUND_ENGINEER: 'Звукорежиссёр', INTERVIEWER: 'Интервьюер' };

export default function EditorialProjectOperations({ project, onOpenTasks }) {
    const { token } = useAuth();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    useEffect(() => {
        let active = true;
        setData(null); setError('');
        api(`/editorial/workflow/projects/${project.id}/operations`, { token })
            .then(result => { if (active) setData(result); })
            .catch(err => { if (active) setError(err.message || 'Не удалось загрузить статистику'); });
        return () => { active = false; };
    }, [project.id, token, refreshKey]);
    if (error) return <div role="alert" className="rounded-xl border border-rose-400/50 p-3 text-sm">{error} <button type="button" className="underline" onClick={() => setRefreshKey(n => n + 1)}>Повторить</button></div>;
    if (!data) return <p role="status" className="text-sm opacity-70">Загружаем состояние проекта…</p>;
    const { totals, members, completionPercent, unassigned } = data;
    const names = new Map(project.members.map(m => [m.userId, m.user?.fullName || m.user?.username || m.userId]));
    const metrics = [
        ['Всего заданий', totals.total], ['Готово', totals.completed], ['В работе', totals.inProgress],
        ['На проверке', totals.inReview], ['На доработке', totals.revision], ['Просрочено', totals.overdue],
        ['Срок в 7 дней', totals.dueSoon], ['С материалами', totals.withMaterials], ['Без исполнителя', unassigned],
    ];
    return <section aria-label="Контроль выполнения проекта" className="space-y-4">
        <div className="rounded-xl border border-current/15 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Готовность проекта</h4><strong>{completionPercent}%</strong></div>
            <div role="progressbar" aria-label="Готовность проекта" aria-valuenow={completionPercent} aria-valuemin={0} aria-valuemax={100} className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${completionPercent}%` }} /></div>
            <p className="mt-2 text-xs opacity-70">Прогресс считается по заданиям со статусом «Утверждено» или «Завершено».</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{metrics.map(([label, count]) => <div key={label} className="rounded-xl border border-current/10 p-3"><div className="text-xl font-bold">{count}</div><div className="text-xs opacity-70">{label}</div></div>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Загрузка команды</h4><button type="button" onClick={() => setRefreshKey(n => n + 1)} className="rounded-lg border px-3 py-2 text-xs">Обновить</button></div>
        <div className="space-y-2">{members.map(member => <div key={member.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-current/10 p-3 text-sm">
            <div className="min-w-0"><strong className="block break-words">{names.get(member.userId)}</strong><span className="text-xs opacity-70">{member.role === 'MANAGER' ? 'Руководитель' : roleNames[member.crewPosition] || 'Участник команды'}</span></div>
            <div className="text-right text-xs"><strong className={member.total ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}>{member.total ? `${member.total} заданий · ${member.completed} готово` : 'Без задания'}</strong>{member.overdue > 0 && <div className="text-rose-600 dark:text-rose-300">Просрочено: {member.overdue}</div>}{member.inReview > 0 && <div>На проверке: {member.inReview}</div>}</div>
        </div>)}</div>
        <button type="button" onClick={onOpenTasks} className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white dark:bg-violet-200 dark:text-slate-950">Открыть задания →</button>
    </section>;
}
