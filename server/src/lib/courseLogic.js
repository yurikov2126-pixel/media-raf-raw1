import { prisma } from './prisma.js';

/**
 * Статус прохождения урока пользователем.
 * Урок считается «полностью пройденным» когда:
 *   - theoryPassed: пройден тест или отмечено вручную (LessonProgress.completed)
 *   - practicalPassed: если есть практика — она APPROVED
 *   - homeworkPassed: если есть ДЗ — она APPROVED
 *
 * Но для разблокировки СЛЕДУЮЩЕГО урока критичны только
 * theory + practical. ДЗ не блокирует прогресс.
 */
export async function getLessonStatuses(userId, courseId) {
    const lessons = await prisma.lesson.findMany({
        where: { courseId },
        orderBy: { order: 'asc' },
        include: {
            test: { select: { id: true } },
            practical: {
                select: {
                    id: true,
                    topic: true,
                    scheduledAt: true,
                    submissions: {
                        where: { userId },
                        select: { status: true, grade: true, feedback: true },
                    },
                },
            },
            homework: {
                select: {
                    id: true,
                    submissions: {
                        where: { userId },
                        select: { status: true, grade: true, feedback: true },
                    },
                },
            },
        },
    });

    const progress = await prisma.lessonProgress.findMany({
        where: { userId, lessonId: { in: lessons.map((l) => l.id) } },
        select: { lessonId: true, completed: true },
    });
    const progressMap = new Map(progress.map((p) => [p.lessonId, p.completed]));

    return lessons.map((l) => {
        const theoryPassed = progressMap.get(l.id) === true;
        const practicalStatus = l.practical?.submissions?.[0]?.status || null;
        const homeworkStatus = l.homework?.submissions?.[0]?.status || null;

        const practicalPassed = !l.practical ? true : practicalStatus === 'APPROVED';
        const homeworkPassed = !l.homework ? true : homeworkStatus === 'APPROVED';

        return {
            lesson: l,
            theoryPassed,
            practicalPassed,
            homeworkPassed,
            practicalStatus,
            homeworkStatus,
            fullyCompleted: theoryPassed && practicalPassed && homeworkPassed,
        };
    });
}

/**
 * Определяет, разблокирован ли урок.
 * Логика: урок открыт, если ВСЕ предыдущие полностью пройдены.
 * Плюс учитываем drip-режим (schedule) и админскую разблокировку.
 */
export function computeAccess({ statuses, index, course, enrollment, unlockOverrides }) {
    if (index === 0) return { unlocked: true, reason: null, unlockAt: null };

    // Админская разблокировка
    const lessonId = statuses[index].lesson.id;
    if (unlockOverrides?.has(lessonId)) {
        return { unlocked: true, reason: null, unlockAt: null };
    }

    // Проверка, что все предыдущие полностью пройдены
    for (let i = 0; i < index; i++) {
        if (!statuses[i].fullyCompleted) {
            const prev = statuses[i];
            if (!prev.theoryPassed) {
                return { unlocked: false, reason: 'Пройдите предыдущий урок', unlockAt: null };
            }
            if (prev.lesson.practical && !prev.practicalPassed) {
                return {
                    unlocked: false,
                    reason: `Сдайте практику «${prev.lesson.practical.topic}»`,
                    unlockAt: null,
                };
            }
        }
    }

    // Drip по расписанию
    if (course.dripMode === 'schedule') {
        const interval = course.dripInterval || 7;
        const start = enrollment?.createdAt ? new Date(enrollment.createdAt) : new Date();
        const unlockAt = new Date(start.getTime() + index * interval * 24 * 60 * 60 * 1000);
        if (new Date() < unlockAt) {
            return {
                unlocked: false,
                reason: `Откроется ${unlockAt.toLocaleDateString('ru-RU')}`,
                unlockAt,
            };
        }
    }

    return { unlocked: true, reason: null, unlockAt: null };
}