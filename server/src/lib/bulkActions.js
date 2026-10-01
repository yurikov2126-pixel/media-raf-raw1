import { prisma } from './prisma.js';
import { createNotification } from './notify.js';

/* ────────── Утилиты ────────── */

async function logAction({ adminId, action, payload = {}, affected = 0, duration = 0, error = null }) {
    try {
        await prisma.adminAction.create({
            data: {
                adminId,
                action,
                payload: JSON.stringify(payload),
                affected,
                duration,
                error,
            },
        });
    } catch (e) {
        console.error('[bulk] logAction error:', e);
    }
}

async function run({ adminId, action, payload, fn }) {
    const start = Date.now();
    try {
        const result = await fn();
        const affected = result?.affected ?? 0;
        await logAction({
            adminId,
            action,
            payload,
            affected,
            duration: Date.now() - start,
        });
        return { ok: true, affected, ...result };
    } catch (e) {
        console.error(`[bulk] ${action} failed:`, e);
        await logAction({
            adminId,
            action,
            payload,
            affected: 0,
            duration: Date.now() - start,
            error: e.message,
        });
        throw e;
    }
}

/* ────────── A. Восстановление ────────── */

export async function recalcAllProgress({ adminId }) {
    return run({
        adminId,
        action: 'recalc_all_progress',
        fn: async () => {
            const enrollments = await prisma.enrollment.findMany({
                include: {
                    course: { include: { lessons: { select: { id: true } } } },
                    user: { select: { id: true } },
                },
            });

            let updated = 0;
            for (const e of enrollments) {
                const total = e.course.lessons.length;
                if (total === 0) continue;

                const done = await prisma.lessonProgress.count({
                    where: {
                        userId: e.userId,
                        completed: true,
                        lesson: { courseId: e.courseId },
                    },
                });
                const progress = Math.round((done / total) * 100);
                const completed = progress === 100;

                if (progress !== e.progress || completed !== e.completed) {
                    await prisma.enrollment.update({
                        where: { id: e.id },
                        data: { progress, completed },
                    });
                    updated++;
                }
            }
            return { affected: updated, total: enrollments.length };
        },
    });
}

export async function issueMissingCertificates({ adminId }) {
    return run({
        adminId,
        action: 'issue_missing_certificates',
        fn: async () => {
            const enrollments = await prisma.enrollment.findMany({
                where: { progress: 100 },
                include: {
                    course: {
                        select: {
                            id: true,
                            title: true,
                            certificateTitle: true,
                            certificateDescription: true,
                        },
                    },
                    user: { select: { id: true, fullName: true } },
                },
            });

            let issued = 0;
            for (const e of enrollments) {
                const existing = await prisma.certificate.findUnique({
                    where: { userId_courseId: { userId: e.userId, courseId: e.courseId } },
                });
                if (existing) continue;

                const serial = `MRR-${new Date().getFullYear()}-${Math.random()
                    .toString(36)
                    .slice(2, 8)
                    .toUpperCase()}`;

                await prisma.certificate.create({
                    data: {
                        userId: e.userId,
                        courseId: e.courseId,
                        serial,
                        title:
                            e.course.certificateTitle ||
                            `Сертификат о прохождении курса «${e.course.title}»`,
                        description: e.course.certificateDescription || null,
                        template: 'gradient',
                    },
                });

                await createNotification(e.userId, 'certificate', {
                    serial,
                    courseTitle: e.course.title,
                });
                issued++;
            }
            return { affected: issued, checked: enrollments.length };
        },
    });
}

export async function recalcUserCourse({ adminId, userId, courseId }) {
    return run({
        adminId,
        action: 'recalc_user_course',
        payload: { userId, courseId },
        fn: async () => {
            const enrollment = await prisma.enrollment.findUnique({
                where: { userId_courseId: { userId, courseId } },
            });
            if (!enrollment) throw new Error('Запись не найдена');

            const total = await prisma.lesson.count({ where: { courseId } });
            if (total === 0) return { affected: 0 };

            const done = await prisma.lessonProgress.count({
                where: { userId, completed: true, lesson: { courseId } },
            });
            const progress = Math.round((done / total) * 100);

            await prisma.enrollment.update({
                where: { id: enrollment.id },
                data: { progress, completed: progress === 100 },
            });
            return { affected: 1, progress };
        },
    });
}

/* ────────── B. Массовые действия ────────── */

async function resolveUsers({ target, direction, group, userIds }) {
    if (target === 'all') {
        return prisma.user.findMany({
            where: { isBanned: false },
            select: { id: true, fullName: true },
        });
    }
    if (target === 'direction') {
        if (!direction) throw new Error('Выберите направление');
        return prisma.user.findMany({
            where: { isBanned: false, direction },
            select: { id: true, fullName: true },
        });
    }
    if (target === 'group') {
        if (!group) throw new Error('Выберите группу');
        return prisma.user.findMany({
            where: { isBanned: false, group },
            select: { id: true, fullName: true },
        });
    }
    if (target === 'custom') {
        if (!Array.isArray(userIds) || userIds.length === 0)
            throw new Error('Выберите пользователей');
        return prisma.user.findMany({
            where: { id: { in: userIds }, isBanned: false },
            select: { id: true, fullName: true },
        });
    }
    throw new Error('Неизвестная цель');
}

export async function enrollUsersToCourse({ adminId, courseId, target, direction, group, userIds }) {
    return run({
        adminId,
        action: 'enroll_to_course',
        payload: { courseId, target, direction, group },
        fn: async () => {
            const course = await prisma.course.findUnique({ where: { id: courseId } });
            if (!course) throw new Error('Курс не найден');

            const users = await resolveUsers({ target, direction, group, userIds });
            let added = 0;
            let skipped = 0;

            for (const u of users) {
                const existing = await prisma.enrollment.findUnique({
                    where: { userId_courseId: { userId: u.id, courseId } },
                });
                if (existing) {
                    skipped++;
                    continue;
                }
                await prisma.enrollment.create({ data: { userId: u.id, courseId } });
                added++;
            }

            return { affected: added, skipped, total: users.length };
        },
    });
}

export async function unenrollUsersFromCourse({ adminId, courseId, target, direction, group, userIds }) {
    return run({
        adminId,
        action: 'unenroll_from_course',
        payload: { courseId, target, direction, group },
        fn: async () => {
            const users = await resolveUsers({ target, direction, group, userIds });
            const ids = users.map((u) => u.id);

            const result = await prisma.enrollment.deleteMany({
                where: { courseId, userId: { in: ids } },
            });
            return { affected: result.count, total: users.length };
        },
    });
}

export async function resetProgressForCourse({ adminId, courseId, target, direction, group, userIds }) {
    return run({
        adminId,
        action: 'reset_progress_for_course',
        payload: { courseId, target, direction, group },
        fn: async () => {
            const users = await resolveUsers({ target, direction, group, userIds });
            const ids = users.map((u) => u.id);

            const lessons = await prisma.lesson.findMany({
                where: { courseId },
                select: { id: true },
            });
            const lessonIds = lessons.map((l) => l.id);
            if (lessonIds.length === 0) return { affected: 0 };

            const delProgress = await prisma.lessonProgress.deleteMany({
                where: { userId: { in: ids }, lessonId: { in: lessonIds } },
            });

            const tests = await prisma.test.findMany({
                where: { lessonId: { in: lessonIds } },
                select: { id: true },
            });
            const testIds = tests.map((t) => t.id);
            if (testIds.length > 0) {
                await prisma.testAttempt.deleteMany({
                    where: { userId: { in: ids }, testId: { in: testIds } },
                });
            }

            await prisma.enrollment.updateMany({
                where: { userId: { in: ids }, courseId },
                data: { progress: 0, completed: false },
            });

            return { affected: delProgress.count, total: ids.length };
        },
    });
}

/* ────────── C. Импорт курсов ────────── */

const QUESTION_TYPES = ['single', 'multiple', 'matching', 'text', 'order'];

/**
 * Валидация структуры курса перед импортом.
 * Возвращает { valid, errors, stats }.
 */
export function validateCurriculum(data) {
    const errors = [];
    const stats = { courses: 0, lessons: 0, tests: 0, questions: 0 };

    if (!Array.isArray(data)) {
        errors.push('Ожидается массив курсов');
        return { valid: false, errors, stats };
    }
    if (data.length === 0) {
        errors.push('Массив курсов пуст');
        return { valid: false, errors, stats };
    }

    data.forEach((c, i) => {
        const ref = `Курс #${i + 1}${c.slug ? ` (${c.slug})` : ''}`;
        if (!c.slug) errors.push(`${ref}: отсутствует slug`);
        if (!c.title) errors.push(`${ref}: отсутствует title`);
        if (c.slug && !/^[a-z0-9-]+$/.test(c.slug)) {
            errors.push(`${ref}: slug может содержать только a-z, 0-9 и дефис`);
        }
        stats.courses++;

        if (!Array.isArray(c.lessons)) {
            if (c.lessons !== undefined) {
                errors.push(`${ref}: lessons должен быть массивом`);
            }
            return;
        }

        c.lessons.forEach((l, j) => {
            const lref = `${ref}, урок #${j + 1}`;
            if (!l.title) errors.push(`${lref}: отсутствует title`);
            stats.lessons++;

            if (l.test) {
                stats.tests++;
                if (!Array.isArray(l.test.questions) || l.test.questions.length === 0) {
                    errors.push(`${lref}: тест без questions`);
                    return;
                }
                l.test.questions.forEach((q, k) => {
                    const qref = `${lref}, вопрос #${k + 1}`;
                    stats.questions++;
                    if (!q.text) errors.push(`${qref}: отсутствует text`);
                    if (!q.type || !QUESTION_TYPES.includes(q.type)) {
                        errors.push(`${qref}: неизвестный type «${q.type}» (доступны: ${QUESTION_TYPES.join(', ')})`);
                    }
                    // Проверка payload по типу
                    const p = q.payload || {};
                    if (q.type === 'single') {
                        if (!Array.isArray(p.options) || p.options.length < 2)
                            errors.push(`${qref}: single — нужно ≥ 2 варианта в payload.options`);
                        if (typeof p.correct !== 'number')
                            errors.push(`${qref}: single — payload.correct должен быть числом`);
                    } else if (q.type === 'multiple') {
                        if (!Array.isArray(p.options) || p.options.length < 2)
                            errors.push(`${qref}: multiple — нужно ≥ 2 варианта`);
                        if (!Array.isArray(p.correct))
                            errors.push(`${qref}: multiple — payload.correct должен быть массивом`);
                    } else if (q.type === 'matching') {
                        if (!Array.isArray(p.left) || !Array.isArray(p.right))
                            errors.push(`${qref}: matching — нужны payload.left и payload.right`);
                        if (!Array.isArray(p.pairs) || p.pairs.length === 0)
                            errors.push(`${qref}: matching — нужны payload.pairs`);
                    } else if (q.type === 'text') {
                        if (typeof p.answer !== 'string' || !p.answer.trim())
                            errors.push(`${qref}: text — payload.answer обязателен`);
                    } else if (q.type === 'order') {
                        if (!Array.isArray(p.items) || p.items.length < 2)
                            errors.push(`${qref}: order — нужно ≥ 2 пункта в payload.items`);
                    }
                });
            }
        });
    });

    return {
        valid: errors.length === 0,
        errors: errors.slice(0, 50), // не показываем больше 50
        stats,
        totalErrors: errors.length,
    };
}

/**
 * Импорт курсов с опциями.
 * mode: 'merge' | 'replace'
 * preserveProgress: true — сохранять прогресс при replace по совпадающим title.
 */
export async function importCurriculum({ adminId, data, mode = 'merge', preserveProgress = false }) {
    return run({
        adminId,
        action: 'import_curriculum',
        payload: { mode, preserveProgress, count: data?.length || 0 },
        fn: async () => {
            if (!Array.isArray(data) || data.length === 0)
                throw new Error('Пустой список курсов');

            const stats = {
                createdCourses: 0,
                updatedCourses: 0,
                createdLessons: 0,
                updatedLessons: 0,
                deletedLessons: 0,
                createdTests: 0,
                createdQuestions: 0,
                restoredProgress: 0,
            };

            for (const c of data) {
                let course = await prisma.course.findUnique({ where: { slug: c.slug } });

                const courseData = {
                    title: c.title,
                    description: c.description || '',
                    category: c.category || 'photo',
                    level: c.level || 'beginner',
                    cover: c.cover || null,
                    published: c.published !== undefined ? !!c.published : true,
                    certificateTitle: c.certificateTitle || 'Сертификат о прохождении курса',
                    certificateDescription: c.certificateDescription || null,
                    dripMode: c.dripMode || null,
                    dripInterval: c.dripInterval ? Number(c.dripInterval) : null,
                };

                if (!course) {
                    course = await prisma.course.create({
                        data: { ...courseData, slug: c.slug },
                    });
                    stats.createdCourses++;
                } else {
                    course = await prisma.course.update({
                        where: { id: course.id },
                        data: courseData,
                    });
                    stats.updatedCourses++;
                }

                if (!Array.isArray(c.lessons) || c.lessons.length === 0) continue;

                if (mode === 'replace') {
                    // Сохраняем прогресс по title (если нужно)
                    let savedProgress = new Map();
                    if (preserveProgress) {
                        const lessons = await prisma.lesson.findMany({
                            where: { courseId: course.id },
                            select: { id: true, title: true },
                        });
                        const idToTitle = new Map(lessons.map((l) => [l.id, l.title]));
                        const progresses = await prisma.lessonProgress.findMany({
                            where: { lessonId: { in: lessons.map((l) => l.id) } },
                        });
                        for (const p of progresses) {
                            const t = idToTitle.get(p.lessonId);
                            if (!t) continue;
                            if (!savedProgress.has(t)) savedProgress.set(t, []);
                            savedProgress.get(t).push(p);
                        }
                    }

                    // Удаляем всё содержимое курса (уроки, тесты, вопросы, прогресс)
                    const del = await prisma.lesson.deleteMany({ where: { courseId: course.id } });
                    stats.deletedLessons += del.count;

                    // Создаём заново
                    for (let i = 0; i < c.lessons.length; i++) {
                        const l = c.lessons[i];
                        if (!l.title) continue;

                        const lesson = await prisma.lesson.create({
                            data: {
                                courseId: course.id,
                                title: l.title,
                                content: l.content || '',
                                videoUrl: l.videoUrl || null,
                                order: l.order ?? i + 1,
                                duration: l.duration ?? 0,
                            },
                        });
                        stats.createdLessons++;

                        // Восстанавливаем прогресс
                        if (preserveProgress && savedProgress.has(l.title)) {
                            for (const old of savedProgress.get(l.title)) {
                                try {
                                    await prisma.lessonProgress.create({
                                        data: {
                                            userId: old.userId,
                                            lessonId: lesson.id,
                                            completed: old.completed,
                                        },
                                    });
                                    stats.restoredProgress++;
                                } catch {
                                    // пропуск конфликтов
                                }
                            }
                        }

                        // Тест
                        if (l.test && Array.isArray(l.test.questions) && l.test.questions.length > 0) {
                            const test = await prisma.test.create({
                                data: {
                                    lessonId: lesson.id,
                                    title: l.test.title || `Тест: ${l.title}`,
                                    passScore: l.test.passScore ?? 70,
                                },
                            });
                            stats.createdTests++;

                            for (const q of l.test.questions) {
                                if (!q.text || !q.type) continue;
                                await prisma.question.create({
                                    data: {
                                        testId: test.id,
                                        type: q.type,
                                        text: q.text,
                                        payload: JSON.stringify(q.payload || {}),
                                        points: q.points ?? 1,
                                    },
                                });
                                stats.createdQuestions++;
                            }
                        }
                    }
                } else {
                    // merge: обновляем существующие уроки по title
                    for (let i = 0; i < c.lessons.length; i++) {
                        const l = c.lessons[i];
                        if (!l.title) continue;

                        let lesson = await prisma.lesson.findFirst({
                            where: { courseId: course.id, title: l.title },
                        });

                        if (!lesson) {
                            lesson = await prisma.lesson.create({
                                data: {
                                    courseId: course.id,
                                    title: l.title,
                                    content: l.content || '',
                                    videoUrl: l.videoUrl || null,
                                    order: l.order ?? i + 1,
                                    duration: l.duration ?? 0,
                                },
                            });
                            stats.createdLessons++;
                        } else {
                            await prisma.lesson.update({
                                where: { id: lesson.id },
                                data: {
                                    content: l.content ?? lesson.content,
                                    videoUrl: l.videoUrl ?? lesson.videoUrl,
                                    order: l.order ?? lesson.order,
                                    duration: l.duration ?? lesson.duration,
                                },
                            });
                            stats.updatedLessons++;
                        }

                        // Тест — пересоздаём целиком, если он есть в JSON
                        if (l.test && Array.isArray(l.test.questions) && l.test.questions.length > 0) {
                            const existingTest = await prisma.test.findUnique({
                                where: { lessonId: lesson.id },
                            });
                            if (existingTest) {
                                await prisma.test.delete({ where: { id: existingTest.id } });
                            }

                            const test = await prisma.test.create({
                                data: {
                                    lessonId: lesson.id,
                                    title: l.test.title || `Тест: ${l.title}`,
                                    passScore: l.test.passScore ?? 70,
                                },
                            });
                            stats.createdTests++;

                            for (const q of l.test.questions) {
                                if (!q.text || !q.type) continue;
                                await prisma.question.create({
                                    data: {
                                        testId: test.id,
                                        type: q.type,
                                        text: q.text,
                                        payload: JSON.stringify(q.payload || {}),
                                        points: q.points ?? 1,
                                    },
                                });
                                stats.createdQuestions++;
                            }
                        }
                    }
                }
            }

            const totalAffected =
                stats.createdCourses +
                stats.updatedCourses +
                stats.createdLessons +
                stats.updatedLessons +
                stats.deletedLessons +
                stats.createdTests +
                stats.createdQuestions;

            return { affected: totalAffected, ...stats };
        },
    });
}

/**
 * Обновить видео уроков по массиву { lessonId, videoUrl }.
 */
export async function updateLessonVideos({ adminId, updates }) {
    return run({
        adminId,
        action: 'update_lesson_videos',
        payload: { count: updates?.length || 0 },
        fn: async () => {
            if (!Array.isArray(updates) || updates.length === 0)
                throw new Error('Пустой список');

            let n = 0;
            for (const u of updates) {
                if (!u.lessonId || !u.videoUrl) continue;
                try {
                    await prisma.lesson.update({
                        where: { id: u.lessonId },
                        data: { videoUrl: u.videoUrl },
                    });
                    n++;
                } catch {
                    // пропуск
                }
            }
            return { affected: n };
        },
    });
}

/* ────────── D. Экспорт ────────── */

function serializeCourse(course) {
    return {
        slug: course.slug,
        title: course.title,
        description: course.description,
        category: course.category,
        level: course.level,
        cover: course.cover,
        published: course.published,
        certificateTitle: course.certificateTitle,
        certificateDescription: course.certificateDescription,
        dripMode: course.dripMode,
        dripInterval: course.dripInterval,
        lessons: (course.lessons || []).map((l) => ({
            title: l.title,
            content: l.content,
            videoUrl: l.videoUrl,
            order: l.order,
            duration: l.duration,
            test: l.test
                ? {
                    title: l.test.title,
                    passScore: l.test.passScore,
                    questions: (l.test.questions || []).map((q) => ({
                        type: q.type,
                        text: q.text,
                        payload: (() => {
                            try {
                                return JSON.parse(q.payload || '{}');
                            } catch {
                                return {};
                            }
                        })(),
                        points: q.points,
                    })),
                }
                : null,
        })),
    };
}

export async function exportCourseAsJSON({ adminId, courseId }) {
    return run({
        adminId,
        action: 'export_course',
        payload: { courseId },
        fn: async () => {
            const course = await prisma.course.findUnique({
                where: { id: courseId },
                include: {
                    lessons: {
                        orderBy: { order: 'asc' },
                        include: {
                            test: {
                                include: { questions: true },
                            },
                        },
                    },
                },
            });
            if (!course) throw new Error('Курс не найден');
            return { affected: 1, course: serializeCourse(course) };
        },
    });
}

export async function exportAllCoursesAsJSON({ adminId }) {
    return run({
        adminId,
        action: 'export_all_courses',
        fn: async () => {
            const courses = await prisma.course.findMany({
                orderBy: { createdAt: 'asc' },
                include: {
                    lessons: {
                        orderBy: { order: 'asc' },
                        include: { test: { include: { questions: true } } },
                    },
                },
            });
            return {
                affected: courses.length,
                courses: courses.map(serializeCourse),
            };
        },
    });
}

export async function exportSnapshot({ adminId }) {
    return run({
        adminId,
        action: 'export_snapshot',
        fn: async () => {
            const [users, courses, certificates] = await Promise.all([
                prisma.user.findMany({
                    select: {
                        id: true, phone: true, email: true, username: true,
                        firstName: true, lastName: true, fullName: true,
                        role: true, direction: true, group: true, city: true,
                        createdAt: true,
                    },
                }),
                prisma.course.findMany({
                    include: { lessons: { orderBy: { order: 'asc' } } },
                }),
                prisma.certificate.findMany({
                    include: {
                        user: { select: { username: true, fullName: true } },
                        course: { select: { slug: true, title: true } },
                    },
                }),
            ]);

            return {
                affected: users.length + courses.length + certificates.length,
                snapshot: {
                    exportedAt: new Date().toISOString(),
                    users,
                    courses: courses.map(serializeCourse),
                    certificates,
                },
            };
        },
    });
}

/* ────────── E. Журнал ────────── */

export async function listActions({ limit = 100 }) {
    return prisma.adminAction.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}