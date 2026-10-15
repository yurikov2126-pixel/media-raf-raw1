export const CLOSED_EDITORIAL_STATUSES = new Set(['DONE', 'APPROVED']);

export function canRemoveEditorialMaterial(file) {
    if (!file?.task?.project?.completedAt) return { allowed:false, reason:'Материал используется в активном проекте.' };
    if (!CLOSED_EDITORIAL_STATUSES.has(file.task.status)) return { allowed:false, reason:'Материал относится к активному заданию.' };
    return { allowed:true };
}

export function canRemoveEditorialProjectFolder(project) {
    if (!project?.completedAt) return { allowed:false, reason:'Проект ещё активен. Завершите его перед удалением папки.' };
    if (project.tasks.some(task => !CLOSED_EDITORIAL_STATUSES.has(task.status))) return { allowed:false, reason:'В проекте остались активные задания.' };
    if (project.tasks.some(task => task._count.materialFiles > 0)) return { allowed:false, reason:'В папке остались файлы. Удалите неиспользуемые материалы по отдельности.' };
    return { allowed:true };
}
