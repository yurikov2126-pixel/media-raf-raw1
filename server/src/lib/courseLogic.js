import { prisma } from './prisma.js';

/**
 * Статус прохождения урока пользователем.
 * Урок считается «полностью пройденным» когда:
 *   - theoryPassed: пройден тест или отмечено вручную (LessonProgress.completed)
 *   - practicalPassed: если есть практика — она APPROVED
 *   - homeworkPassed: если есть ДЗ — она APPROVED (не блокирует прогресс)
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
 * Общая проверка «все предыдущие пройдены».
 * Возвращает { ok: true } или { ok: false, reason }.
 */
function checkPreviousPassed(statuses, index) {
    if (index === 0) return { ok: true };
    for (let i = 0; i < index; i++) {
        const prev = statuses[i];
        if (!prev.theoryPassed) {
            return {
                ok: false,
                reason: 'Пройдите предыдущий урок',
                unlockAt: null,
            };
        }
        if (prev.lesson.practical && !prev.practicalPassed) {
            return {
                ok: false,
                reason: `Сдайте практику «${prev.lesson.practical.topic}»`,
                unlockAt: null,
            };
        }
    }
    return { ok: true };
}

/**
 * Определяет, разблокирован ли урок.
 *
 * Режимы:
 *   null / '' / undefined — все уроки открыты сразу
 *   'test'                — следующий урок после сдачи теста/практики предыдущего
 *   'test_weekly'         — то же + лимит открытых уроков в неделю
 *                           (weeklyLessonLimit штук каждые 7 дней)
 *   'schedule'            — по времени: N × dripInterval дней от даты записи
 *
 * Админская разблокировка (unlockOverrides) работает поверх всего.
 */
export function computeAccess({ statuses, index, course, enrollment, unlockOverrides }) {
    const lesson = statuses[index].lesson;

    // 1. Админская разблокировка
    if (unlockOverrides?.has(lesson.id)) {
        return { unlocked: true, reason: null, unlockAt: null };
    }

    // 2. Открыт сразу
    if (!course.dripMode) {
        return { unlocked: true, reason: null, unlockAt: null };
    }

    // 3. После теста
    if (course.dripMode === 'test') {
        if (index === 0) return { unlocked: true, reason: null, unlockAt: null };
        const prev = checkPreviousPassed(statuses, index);
        if (!prev.ok) return { unlocked: false, ...prev };
        return { unlocked: true, reason: null, unlockAt: null };
    }

    // 4. После теста + лимит в неделю
    if (course.dripMode === 'test_weekly') {
        if (index === 0) return { unlocked: true, reason: null, unlockAt: null };

        const weeklyLimit = Math.max(1, Number(course.weeklyLessonLimit) || 3);
        const start = enrollment?.createdAt
            ? new Date(enrollment.createdAt)
            : new Date();

        const msInDay = 24 * 60 * 60 * 1000;
        const daysSince = Math.floor((Date.now() - start.getTime()) / msInDay);
        const weekNumber = Math.floor(daysSince / 7); // 0-based: 0 — первая неделя
        const maxAvailableIndex = (weekNumber + 1) * weeklyLimit - 1;

        // Урок ещё не вошёл в доступную порцию — ждём неделю
        if (index > maxAvailableIndex) {
            const weekToOpen = Math.floor(index / weeklyLimit); // на какой неделе откроется
            const unlockAt = new Date(start.getTime() + weekToOpen * 7 * msInDay);
            return {
                unlocked: false,
                reason: `Откроется ${unlockAt.toLocaleDateString('ru-RU')} — не более ${weeklyLimit} уроков в неделю`,
                unlockAt,
            };
        }

        // Урок внутри порции — проверяем, что предыдущие пройдены
        const prev = checkPreviousPassed(statuses, index);
        if (!prev.ok) return { unlocked: false, ...prev };

        return { unlocked: true, reason: null, unlockAt: null };
    }

    // 5. По расписанию
    if (course.dripMode === 'schedule') {
        if (index === 0) return { unlocked: true, reason: null, unlockAt: null };

        const interval = Number(course.dripInterval) || 7;
        const start = enrollment?.createdAt
            ? new Date(enrollment.createdAt)
            : new Date();
        const msInDay = 24 * 60 * 60 * 1000;
        const unlockAt = new Date(start.getTime() + index * interval * msInDay);

        if (new Date() < unlockAt) {
            return {
                unlocked: false,
                reason: `Откроется ${unlockAt.toLocaleDateString('ru-RU')}`,
                unlockAt,
            };
        }
        return { unlocked: true, reason: null, unlockAt: null };
    }

    // 6. Неизвестный режим — открыто
    return { unlocked: true, reason: null, unlockAt: null };
}