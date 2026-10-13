import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
import { createNotification } from '../lib/notify.js';
import {
    onLessonCompleted,
    onTestPassed,
    onTestFailed,
    onCertificateEarned,
} from '../lib/gamification.js';
import { getLessonStatuses, computeAccess } from '../lib/courseLogic.js';
import { shuffledIndices, shuffleArray } from '../lib/shuffle.js';

const router = Router();

function makeSerial() {
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `MRR-${year}-${rand}`;
}

async function issueCertificateIfNeeded(userId, courseId) {
    const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment || enrollment.progress < 100) return null;

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return null;

    const existing = await prisma.certificate.findUnique({
        where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return existing;

    const cert = await prisma.certificate.create({
        data: {
            userId,
            courseId,
            serial: makeSerial(),
            title: course.certificateTitle || `Сертификат о прохождении курса «${course.title}»`,
            description: course.certificateDescription || null,
            template: 'gradient',
        },
    });

    await createNotification(userId, 'certificate', {
        certificateId: cert.id,
        serial: cert.serial,
        courseTitle: course.title,
    });

    return cert;
}

function scoreQuestion(question, userAnswer, seed) {
    const p = (() => {
        try { return JSON.parse(question.payload || '{}'); } catch { return {}; }
    })();
    const type = question.type || 'single';
    const max = question.points;
    let gained = 0;

    const permOptions = (Array.isArray(p.options) && p.options.length)
        ? shuffledIndices(p.options.length, `${seed}:${question.id}`)
        : null;

    const permRight = (Array.isArray(p.right) && p.right.length)
        ? shuffledIndices(p.right.length, `${seed}:right:${question.id}`)
        : null;

    switch (type) {
        case 'single': {
            if (permOptions) {
                const origIdx = permOptions[Number(userAnswer)];
                if (origIdx === Number(p.correct)) gained = max;
            } else {
                if (Number(userAnswer) === Number(p.correct)) gained = max;
            }
            break;
        }
        case 'multiple': {
            const ua = Array.isArray(userAnswer) ? userAnswer.map(Number) : [];
            const ca = Array.isArray(p.correct) ? p.correct.map(Number) : [];
            if (permOptions) {
                const uaOriginal = ua.map((s) => permOptions[s]);
                const uaSet = new Set(uaOriginal);
                const caSet = new Set(ca);
                if (
                    uaSet.size === caSet.size &&
                    [...uaSet].every((v) => caSet.has(v))
                ) {
                    gained = max;
                }
            } else {
                const uaSorted = [...ua].sort((a, b) => a - b);
                const caSorted = [...ca].sort((a, b) => a - b);
                if (
                    uaSorted.length === caSorted.length &&
                    uaSorted.every((v, i) => v === caSorted[i])
                ) {
                    gained = max;
                }
            }
            break;
        }
        case 'matching': {
            const ua = userAnswer && typeof userAnswer === 'object' ? userAnswer : {};
            const pairs = Array.isArray(p.pairs) ? p.pairs : [];
            if (!pairs.length) break;
            let ok = 0;
            for (const [li, ri] of pairs) {
                const userShuffled = Number(ua[li]);
                const userOriginal = permRight ? permRight[userShuffled] : userShuffled;
                if (userOriginal === Number(ri)) ok++;
            }
            gained = (ok / pairs.length) * max;
            break;
        }
        case 'text': {
            const ua = String(userAnswer ?? '').trim();
            const ca = String(p.answer ?? '').trim();
            if (p.caseSensitive ? ua === ca : ua.toLowerCase() === ca.toLowerCase()) {
                gained = max;
            }
            break;
        }
        case 'order': {
            const ua = Array.isArray(userAnswer) ? userAnswer.map(Number) : [];
            const n = Array.isArray(p.items) ? p.items.length : 0;
            if (ua.length === n && ua.every((v, i) => v === i)) gained = max;
            break;
        }
    }
    return { gained, max };
}

function sanitizePayload(question, seed) {
    const p = (() => {
        try { return JSON.parse(question.payload || '{}'); } catch { return {}; }
    })();
    const safe = { ...p };
    delete safe.correct;
    delete safe.answer;
    delete safe.pairs;

    if ((question.type === 'single' || question.type === 'multiple') &&
        Array.isArray(p.options) && p.options.length > 1) {
        safe.options = shuffleArray(p.options, `${seed}:${question.id}`);
    }

    if (question.type === 'matching' &&
        Array.isArray(p.right) && p.right.length > 1) {
        safe.right = shuffleArray(p.right, `${seed}:right:${question.id}`);
    }

    return JSON.stringify(safe);
}

/* ─────────── Список курсов ─────────── */
router.get('/', auth, async (req, res) => {
    const courses = await prisma.course.findMany({
        where: { published: true },
        include: {
            lessons: { select: { id: true } },
            _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: 'asc' },
    });
    const myEnrollments = await prisma.enrollment.findMany({
        where: { userId: req.user.id },
    });
    const enrollmentByCourse = new Map(myEnrollments.map((entry) => [entry.courseId, entry]));
    const progress = await prisma.lessonProgress.findMany({
        where: { userId: req.user.id, lesson: { courseId: { in: myEnrollments.map((entry) => entry.courseId) } } },
        select: { lessonId: true, completed: true },
    });
    const completedIds = new Set(progress.filter((item) => item.completed).map((item) => item.lessonId));
    const courseLessons = await prisma.lesson.findMany({
        where: { courseId: { in: myEnrollments.map((entry) => entry.courseId) } },
        orderBy: { order: 'asc' },
        select: { id: true, courseId: true, order: true },
    });
    const lessonsByCourse = new Map();
    for (const lesson of courseLessons) {
        if (!lessonsByCourse.has(lesson.courseId)) lessonsByCourse.set(lesson.courseId, []);
        lessonsByCourse.get(lesson.courseId).push(lesson);
    }
    res.json(courses.map((c) => {
        const enrollment = enrollmentByCourse.get(c.id);
        const lessons = lessonsByCourse.get(c.id) || [];
        const saved = lessons.find((lesson) => lesson.id === enrollment?.lastLessonId);
        const suggested = lessons.find((lesson) => !completedIds.has(lesson.id)) || lessons[0];
        return {
            ...c,
            enrolled: !!enrollment,
            progress: enrollment?.progress ?? null,
            resumeLessonOrder: saved?.order ?? suggested?.order ?? null,
            completedLessons: lessons.filter((lesson) => completedIds.has(lesson.id)).length,
        };
    }));
});

/* ─────────── Учебный кабинет текущего студента ─────────── */
router.get('/my-learning', auth, async (req, res) => {
    try {
        const [enrollments, submissions, attempts, certificates] = await Promise.all([
            prisma.enrollment.findMany({
                where: { userId: req.user.id },
                include: { course: { select: { id: true, slug: true, title: true, cover: true, lessons: { orderBy: { order: 'asc' }, select: { id: true, order: true, title: true } } } } },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.homework.findMany({
                where: { lesson: { course: { enrollments: { some: { userId: req.user.id } } } } },
                include: {
                    lesson: { select: { order: true, course: { select: { slug: true, title: true } } } },
                    submissions: { where: { userId: req.user.id }, take: 1 },
                },
            }),
            prisma.testAttempt.findMany({
                where: { userId: req.user.id },
                orderBy: { createdAt: 'desc' },
                take: 30,
                include: { test: { select: { title: true, lesson: { select: { order: true, course: { select: { slug: true, title: true } } } } } } },
            }),
            prisma.certificate.findMany({
                where: { userId: req.user.id },
                orderBy: { issuedAt: 'desc' },
            }),
        ]);
        res.json({
            courses: enrollments.map(({ course, progress, completed, lastLessonId }) => {
                const lessons = course.lessons;
                return {
                    id: course.id, slug: course.slug, title: course.title, cover: course.cover,
                    progress, completed, totalLessons: lessons.length,
                    resumeLessonOrder: lessons.find((l) => l.id === lastLessonId)?.order ?? lessons[0]?.order ?? null,
                };
            }),
            assignments: submissions.map((hw) => {
                const s = hw.submissions[0];
                return {
                    id: hw.id, status: s?.status || 'NOT_SUBMITTED', feedback: s?.feedback ?? null,
                    grade: s?.finalGrade ?? s?.grade ?? null, updatedAt: s?.updatedAt ?? null,
                    title: hw.title, courseTitle: hw.lesson.course.title, slug: hw.lesson.course.slug,
                    lessonOrder: hw.lesson.order,
                };
            }),
            results: attempts.map((a) => ({
                id: a.id, score: a.score, passed: a.passed, createdAt: a.createdAt,
                title: a.test.title, slug: a.test.lesson.course.slug, courseTitle: a.test.lesson.course.title,
                lessonOrder: a.test.lesson.order,
            })),
            certificates: certificates.map((c) => ({
                id: c.id, title: c.title, issuedAt: c.issuedAt,
            })),
        });
    } catch (error) {
        console.error('[academy] dashboard failed', error);
        res.status(500).json({ error: 'Не удалось загрузить учебный кабинет' });
    }
});

/* ─────────── Конкретный курс ─────────── */
router.get('/:slug', auth, async (req, res) => {
    const course = await prisma.course.findUnique({
        where: { slug: req.params.slug },
        include: {
            lessons: {
                orderBy: { order: 'asc' },
                include: {
                    test: { include: { questions: true } },
                    practical: {
                        include: {
                            supervisor: { select: { id: true, fullName: true, username: true, avatar: true } },
                            submissions: {
                                where: { userId: req.user.id },
                                include: {
                                    reviewer: { select: { id: true, fullName: true, username: true } },
                                },
                            },
                        },
                    },
                    homework: {
                        include: {
                            submissions: {
                                where: { userId: req.user.id },
                                include: {
                                    reviewer: { select: { id: true, fullName: true, username: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!course) return res.status(404).json({ error: 'Курс не найден' });

    const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: req.user.id, courseId: course.id } },
    });
    const certificate = await prisma.certificate.findUnique({
        where: { userId_courseId: { userId: req.user.id, courseId: course.id } },
    });

    // Админские разблокировки (для этого пользователя)
    const overrides = await prisma.lessonProgress.findMany({
        where: {
            userId: req.user.id,
            lesson: { courseId: course.id },
        },
        select: { lessonId: true },
    });
    const overrideSet = new Set(overrides.map((o) => o.lessonId));

    // Статусы и доступ
    const statuses = await getLessonStatuses(req.user.id, course.id);

    // Дедлайны ДЗ для текущего пользователя (batch-запрос прогресса)
    const hwLessonIds = course.lessons.filter((l) => l.homework).map((l) => l.id);
    const hwProgresses = hwLessonIds.length
        ? await prisma.lessonProgress.findMany({
            where: { userId: req.user.id, lessonId: { in: hwLessonIds } },
            select: { lessonId: true, completed: true, completedAt: true },
        })
        : [];
    const hwProgressMap = new Map(hwProgresses.map((p) => [p.lessonId, p]));

    const lessons = course.lessons.map((l, i) => {
        const s = statuses[i];
        const access = computeAccess({
            statuses,
            index: i,
            course,
            enrollment,
            unlockOverrides: overrideSet,
        });

        // Чистим ответы теста от правильных вариантов + шаффлим
        const safeTest = l.test
            ? {
                ...l.test,
                questions: l.test.questions.map((q) => ({
                    ...q,
                    payload: sanitizePayload(q, req.user.id),
                })),
            }
            : null;

        // Дедлайн ДЗ
        let homeworkWithDeadline = l.homework;
        if (l.homework) {
            const hw = l.homework;
            let deadline = null;
            if (hw.hoursToComplete != null) {
                const lp = hwProgressMap.get(l.id);
                if (lp?.completed && lp.completedAt) {
                    deadline = new Date(
                        lp.completedAt.getTime() + hw.hoursToComplete * 60 * 60 * 1000
                    );
                }
            } else if (hw.dueAt) {
                deadline = hw.dueAt;
            }
            homeworkWithDeadline = { ...hw, deadline };
        }

        return {
            ...l,
            homework: homeworkWithDeadline,
            test: safeTest,
            unlocked: access.unlocked,
            unlockAt: access.unlockAt,
            lockReason: access.reason,
            theoryPassed: s.theoryPassed,
            practicalPassed: s.practicalPassed,
            homeworkPassed: s.homeworkPassed,
            fullyCompleted: s.fullyCompleted,
        };
    });

    res.json({
        ...course,
        lessons,
        enrolled: !!enrollment,
        resumeLessonOrder: lessons.find((l) => l.id === enrollment?.lastLessonId && l.unlocked)?.order ?? lessons.find((l) => l.unlocked && !l.fullyCompleted)?.order ?? lessons.find((l) => l.unlocked)?.order ?? null,
        certificate,
    });
});

/* ─────────── Запомнить текущий урок (между устройствами) ─────────── */
router.post('/:slug/resume', auth, async (req, res) => {
    const order = Number(req.body?.order);
    if (!Number.isInteger(order) || order < 1) return res.status(400).json({ error: 'Некорректный номер урока' });
    const course = await prisma.course.findUnique({ where: { slug: req.params.slug }, select: { id: true, dripMode: true, dripInterval: true, weeklyLessonLimit: true } });
    if (!course) return res.status(404).json({ error: 'Курс не найден' });
    const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: req.user.id, courseId: course.id } } });
    if (!enrollment) return res.status(403).json({ error: 'Нет записи на курс' });
    const statuses = await getLessonStatuses(req.user.id, course.id);
    const index = statuses.findIndex(({ lesson }) => lesson.order === order);
    if (index < 0) return res.status(404).json({ error: 'Урок не найден' });
    const overrides = await prisma.lessonProgress.findMany({
        where: { userId: req.user.id, lesson: { courseId: course.id } },
        select: { lessonId: true },
    });
    const access = computeAccess({ statuses, index, course, enrollment, unlockOverrides: new Set(overrides.map((v) => v.lessonId)) });
    if (!access.unlocked) return res.status(403).json({ error: access.reason || 'Урок закрыт' });
    await prisma.enrollment.update({
        where: { userId_courseId: { userId: req.user.id, courseId: course.id } },
        data: { lastLessonId: statuses[index].lesson.id },
    });
    res.json({ order });
});

/* ─────────── Запись на курс (принимает id ИЛИ slug) ─────────── */
router.post('/:idOrSlug/enroll', auth, async (req, res) => {
    try {
        const key = req.params.idOrSlug;

        let course = await prisma.course.findUnique({ where: { id: key } });
        if (!course) course = await prisma.course.findUnique({ where: { slug: key } });
        if (!course) return res.status(404).json({ error: 'Курс не найден' });

        const enrollment = await prisma.enrollment.upsert({
            where: { userId_courseId: { userId: req.user.id, courseId: course.id } },
            update: {},
            create: { userId: req.user.id, courseId: course.id },
        });

        res.json({
            id: enrollment.id,
            courseId: course.id,
            courseSlug: course.slug,
            progress: enrollment.progress,
            createdAt: enrollment.createdAt,
        });
    } catch (e) {
        console.error('[courses] enroll error:', e);
        res.status(500).json({ error: e.message || 'Не удалось записаться' });
    }
});

/* ─────────── Прогресс по курсу ─────────── */
async function recalcProgress(userId, courseId) {
    const statuses = await getLessonStatuses(userId, courseId);
    const total = statuses.length;
    // Прогресс учитывает ТОЛЬКО theory + practical (ДЗ не блокирует)
    const done = statuses.filter(
        (s) => s.theoryPassed && s.practicalPassed
    ).length;
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);

    await prisma.enrollment.update({
        where: { userId_courseId: { userId, courseId } },
        data: { progress, completed: progress === 100 },
    });

    return progress;
}

/* ─────────── Отметить урок пройденным (без теста) ─────────── */
router.post('/lessons/:lessonId/complete', auth, async (req, res) => {
    try {
        const lesson = await prisma.lesson.findUnique({
            where: { id: req.params.lessonId },
            include: {
                course: true,
                test: { select: { id: true } },
            },
        });
        if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

        if (lesson.test) {
            return res.status(400).json({
                error: 'Урок содержит тест. Пройдите тестирование, чтобы завершить урок.',
            });
        }

        const enrollment = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId: req.user.id, courseId: lesson.courseId } },
        });
        if (!enrollment) return res.status(403).json({ error: 'Не записаны на курс' });

        const existing = await prisma.lessonProgress.findUnique({
            where: { userId_lessonId: { userId: req.user.id, lessonId: lesson.id } },
        });
        const wasAlready = existing?.completed === true;

        await prisma.lessonProgress.upsert({
            where: { userId_lessonId: { userId: req.user.id, lessonId: lesson.id } },
            update: {
                completed: true,
                completedAt: existing?.completedAt || new Date(),
            },
            create: {
                userId: req.user.id,
                lessonId: lesson.id,
                completed: true,
                completedAt: new Date(),
            },
        });

        const progress = await recalcProgress(req.user.id, lesson.courseId);

        let certificate = null;
        let wasCertNew = false;
        if (progress === 100) {
            const before = await prisma.certificate.findUnique({
                where: { userId_courseId: { userId: req.user.id, courseId: lesson.courseId } },
            });
            certificate = await issueCertificateIfNeeded(req.user.id, lesson.courseId);
            wasCertNew = !before && !!certificate;
        }

        if (!wasAlready) {
            onLessonCompleted(req.user.id, lesson.id).catch((e) =>
                console.error('[courses] gamif lesson:', e)
            );
        }
        if (wasCertNew && certificate) {
            onCertificateEarned(req.user.id, certificate.id).catch((e) =>
                console.error('[courses] gamif cert:', e)
            );
        }

        res.json({ progress, certificate });
    } catch (e) {
        console.error('[courses] complete error:', e);
        res.status(500).json({ error: e.message || 'Не удалось отметить урок' });
    }
});

/* ─────────── Отправка теста ─────────── */
router.post('/tests/:testId/submit', auth, async (req, res) => {
    try {
        const { answers } = req.body;
        const test = await prisma.test.findUnique({
            where: { id: req.params.testId },
            include: {
                questions: true,
                lesson: { include: { course: true } },
            },
        });
        if (!test) return res.status(404).json({ error: 'Тест не найден' });

        const enrollment = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId: req.user.id, courseId: test.lesson.courseId } },
        });
        if (!enrollment) return res.status(403).json({ error: 'Не записаны на курс' });

        let gained = 0;
        let max = 0;
        const wrongQuestions = [];

        for (const q of test.questions) {
            const userAnswer = answers ? answers[q.id] : undefined;
            const r = scoreQuestion(q, userAnswer, req.user.id);
            gained += r.gained;
            max += r.max;

            if (r.gained < r.max) {
                wrongQuestions.push({
                    id: q.id,
                    type: q.type,
                    text: q.text,
                    payload: sanitizePayload(q, req.user.id),
                    userAnswer: userAnswer ?? null,
                    gained: r.gained,
                    max: r.max,
                });
            }
        }

        const percent = max > 0 ? Math.round((gained / max) * 100) : 0;
        const passed = percent >= test.passScore;

        await prisma.testAttempt.create({
            data: {
                testId: test.id,
                userId: req.user.id,
                score: percent,
                passed,
                answers: JSON.stringify(answers || {}),
            },
        });

        let certificate = null;
        let wasCertNew = false;

        if (passed) {
            const existing = await prisma.lessonProgress.findUnique({
                where: { userId_lessonId: { userId: req.user.id, lessonId: test.lessonId } },
            });
            const wasAlready = existing?.completed === true;

            await prisma.lessonProgress.upsert({
                where: { userId_lessonId: { userId: req.user.id, lessonId: test.lessonId } },
                update: {
                    completed: true,
                    completedAt: existing?.completedAt || new Date(),
                },
                create: {
                    userId: req.user.id,
                    lessonId: test.lessonId,
                    completed: true,
                    completedAt: new Date(),
                },
            });

            const progress = await recalcProgress(req.user.id, test.lesson.courseId);

            if (progress === 100) {
                const before = await prisma.certificate.findUnique({
                    where: { userId_courseId: { userId: req.user.id, courseId: test.lesson.courseId } },
                });
                certificate = await issueCertificateIfNeeded(req.user.id, test.lesson.courseId);
                wasCertNew = !before && !!certificate;
            }

            onTestPassed(req.user.id, test.id, percent).catch((e) =>
                console.error('[courses] gamif test pass:', e)
            );
            if (!wasAlready) {
                onLessonCompleted(req.user.id, test.lessonId).catch((e) =>
                    console.error('[courses] gamif lesson:', e)
                );
            }
            if (wasCertNew && certificate) {
                onCertificateEarned(req.user.id, certificate.id).catch((e) =>
                    console.error('[courses] gamif cert:', e)
                );
            }
        } else {
            onTestFailed(req.user.id, test.id, percent).catch((e) =>
                console.error('[courses] gamif test fail:', e)
            );
        }

        res.json({
            score: percent,
            passed,
            certificate,
            wrongQuestions,
            totalQuestions: test.questions.length,
        });
    } catch (e) {
        console.error('[courses] submit test error:', e);
        res.status(500).json({ error: e.message || 'Не удалось обработать тест' });
    }
});

/* ─────────── Сертификат ─────────── */
router.get('/certificates/:id', auth, async (req, res) => {
    const cert = await prisma.certificate.findUnique({
        where: { id: req.params.id },
        include: {
            user: { select: { id: true, fullName: true, username: true } },
            course: { select: { id: true, title: true, slug: true } },
        },
    });
    if (!cert) return res.status(404).json({ error: 'Не найден' });
    const isOwner = cert.userId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Нет доступа' });
    res.json(cert);
});

export default router;