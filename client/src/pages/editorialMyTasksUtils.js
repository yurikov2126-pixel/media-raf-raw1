export const STATUS_LABELS = {
    TODO:'К выполнению', IN_PROGRESS:'В работе', IN_REVIEW:'На проверке',
    REVISION:'На доработке', APPROVED:'Утверждено', DONE:'Завершено',
};
export const STATUS_ORDER = ['REVISION','IN_PROGRESS','TODO','IN_REVIEW','APPROVED','DONE'];
export function isFinished(task) { return task.status === 'DONE' || task.status === 'APPROVED'; }
export function deadlineState(task, now = Date.now()) {
    if (!task.dueAt || isFinished(task)) return 'none';
    const due = new Date(task.dueAt).getTime();
    if (!Number.isFinite(due)) return 'none';
    if (due < now) return 'overdue';
    if (due - now <= 48 * 60 * 60 * 1000) return 'soon';
    return 'future';
}
export function taskPriority(task, now = Date.now()) {
    const deadline = deadlineState(task, now);
    return (task.status === 'REVISION' ? -100 : 0)
        + (deadline === 'overdue' ? -60 : deadline === 'soon' ? -30 : 0)
        + (isFinished(task) ? 200 : 0);
}
export function sortPersonalTasks(tasks, now = Date.now()) {
    return [...tasks].sort((a,b) => taskPriority(a,now) - taskPriority(b,now)
        || (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity)
        || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
export function taskSummary(tasks, now = Date.now()) {
    return {
        active:tasks.filter(task => !isFinished(task)).length,
        soon:tasks.filter(task => deadlineState(task,now) === 'soon').length,
        overdue:tasks.filter(task => deadlineState(task,now) === 'overdue').length,
        revision:tasks.filter(task => task.status === 'REVISION').length,
    };
}
