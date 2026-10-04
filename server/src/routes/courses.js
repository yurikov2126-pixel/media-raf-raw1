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
            title:
                course.certificateTitle ||
                `Сертификат о прохождении курса «${course.title}»`,
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

function scoreQuestion(question, userAnswer) {
    const p = (() => {
        try {
            return JSON.parse(question.payload || '{}');
        } catch {
            return {};
        }
    })();
    const type = question.type || 'single';
    const max = question.points;
    let gained = 0;

    switch (type) {
        case 'single':
            if (Number(userAnswer) === Number(p.correct)) gained = max;
            break;
        case 'multiple': {
            const ua = Array.isArray(userAnswer) ? [...userAnswer].map(Number).sort() : [];
            const ca = Array.isArray(p.correct) ? [...p.correct].map(Number).sort() : [];
            if (ua.length === ca.length && ua.every((v, i) => v === ca[i])) gained = max;
            break;
        }
        case 'matching': {
            const ua = userAnswer && typeof userAnswer === 'object' ? userAnswer : {};
            const pairs = Array.isArray(p.pairs) ? p.pairs : [];
            if (!pairs.length) break;
            let ok = 0;
            for (const [li, ri] of pairs) if (Number(ua[li]) === Number(ri)) ok++;
            gained = (ok / pairs.length) * max;
            break;
        }
        case 'text': {
            const ua = String(userAnswer ?? '').trim();
            const ca = String(p.answer ?? '').trim();
            if (p.caseSensitive ? ua === ca : ua.toLowerCase() === ca.toLowerCase())
                gained = max;
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

function sanitizePayload(question) {
    const p = (() => {
        try {
            return JSON.parse(question.payload || '{}');
        } catch {
            return {};
        }
    })();
    const safe = { ...p };
    delete safe.correct;
    delete safe.answer;
    delete safe.pairs;
    return JSON.stringify(safe);
}

/**
 * Вычисляет доступность урока с учётом drip.
 */
function computeLessonAccess({ course, lesson, enrollment, completedLessonIds }) {
    if (!course.dripMode) return { unlocked: true, unlockAt: null, reason: null };

    const sorted = [...course.lessons].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((l) => l.id === lesson.id);
    if (idx <= 0) return { unlocked: true, unlockAt: null, reason: null };

    if (course.dripMode === 'test') {
        for (let i = 0; i < idx; i++) {
            if (!completedLessonIds.has(sorted[i].id)) {
                return { unlocked: false, unlockAt: null, reason: 'Пройдите предыдущие уроки' };
            }
        }
        return { unlocked: true, unlockAt: null, reason: null };
    }

    if (course.dripMode === 'schedule') {
        const interval = course.dripInterval || 7;
        const start = enrollment?.createdAt ? new Date(enrollment.createdAt) : new Date();
        const unlockAt = new Date(start.getTime() + idx * interval * 24 * 60 * 60 * 1000);
        const now = new Date();
        if (now < unlockAt) {
            return {
                unlocked: false,
                unlockAt,
                reason: `Откроется ${unlockAt.toLocaleDateString('ru-RU')}`,
            };
        }
        return { unlocked: true, unlockAt, reason: null };
    }

    return { unlocked: true, unlockAt: null, reason: null };
}

// Считает пройденные уроки пользователя в конкретном курсе
async function countCompletedInCourse(userId, courseId) {
    return prisma.lessonProgress.count({
        where: {
            userId,
            completed: true,
            lesson: { courseId },
        },
    });
}

// Считает пройденные уроки пользователя во всех курсах (для computeLessonAccess)
async function getCompletedLessonIds(userId) {
    const rows = await prisma.lessonProgress.findMany({
        where: { userId, completed: true },
        select: { lessonId: true },
    });
    return new Set(rows.map((r) => r.lessonId));
}

router.get('/', auth, async (req, res) => {
    const courses = await prisma.course.findMany({
        where: { published: true },
        include: {
            lessons: { select: { id: true } },
            _count: { select: { enrollments: true } },
        },
    });
    const myEnrollments = await prisma.enrollment.findMany({
        where: { userId: req.user.id },
    });
    res.json(
        courses.map((c) => ({
            ...c,
            enrolled: myEnrollments.some((e) => e.courseId === c.id),
            progress: myEnrollments.find((e) => e.courseId === c.id)?.progress ?? null,
        }))
    );
});

router.get('/:slug', auth, async (req, res) => {
    const course = await prisma.course.findUnique({
        where: { slug: req.params.slug },
        include: {
            lessons: {
                orderBy: { order: 'asc' },
                include: { test: { include: { questions: true } } },
            },
        },
    });
    if (!course) return res.status(404).json({ error: 'Курс не найден' });

    const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: req.user.id, courseId: course.id } },
    });
    const progress = await prisma.lessonProgress.findMany({
        where: { userId: req.user.id },
    });
    const certificate = await prisma.certificate.findUnique({
        where: { userId_courseId: { userId: req.user.id, courseId: course.id } },
    });

    const completedLessonIds = new Set(
        progress.filter((p) => p.completed).map((p) => p.lessonId)
    );

    const lessons = course.lessons.map((l) => {
        const access = computeLessonAccess({
            course,
            lesson: l,
            enrollment,
            completedLessonIds,
        });
        return {
            ...l,
            test: l.test
                ? {
                    ...l.test,
                    questions: l.test.questions.map((q) => ({
                        ...q,
                        payload: sanitizePayload(q),
                    })),
                }
                : null,
            unlocked: access.unlocked,
            unlockAt: access.unlockAt,
            lockReason: access.reason,
        };
    });

    res.json({
        ...course,
        lessons,
        enrolled: !!enrollment,
        progress,
        certificate,
    });
});

router.post('/:id/enroll', auth, async (req, res) => {
    const enrollment = await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: req.user.id, courseId: req.params.id } },
        update: {},
        create: { userId: req.user.id, courseId: req.params.id },
    });
    res.json(enrollment);
});

// ─── Отметить урок пройденным ────────────────────────────────
// НЕ разрешаем, если у урока есть тест — урок закрывается только через прохождение теста.
router.post('/lessons/:lessonId/complete', auth, async (req, res) => {
    try {
        const lesson = await prisma.lesson.findUnique({
            where: { id: req.params.lessonId },
            include: {
                course: { include: { lessons: true } },
                test: { select: { id: true } },
            },
        });
        if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

        // Защита: если у урока есть тест, эту кнопку использовать нельзя
        if (lesson.test) {
            return res.status(400).json({
                error: 'Урок содержит тест. Пройдите тестирование, чтобы завершить урок.',
            });
        }

        const enrollment = await prisma.enrollment.findUnique({
            where: {
                userId_courseId: { userId: req.user.id, courseId: lesson.courseId },
            },
        });
        if (!enrollment) return res.status(403).json({ error: 'Не записаны на курс' });

        const completedLessonIds = await getCompletedLessonIds(req.user.id);

        const access = computeLessonAccess({
            course: lesson.course,
            lesson,
            enrollment,
            completedLessonIds,
        });
        if (!access.unlocked) {
            return res.status(403).json({ error: access.reason || 'Урок пока недоступен' });
        }

        // Проверяем, не был ли урок уже пройден — чтобы не начислить XP дважды
        const existingProgress = await prisma.lessonProgress.findUnique({
            where: { userId_lessonId: { userId: req.user.id, lessonId: lesson.id } },
        });
        const wasAlreadyCompleted = existingProgress?.completed === true;

        await prisma.lessonProgress.upsert({
            where: { userId_lessonId: { userId: req.user.id, lessonId: lesson.id } },
            update: { completed: true },
            create: { userId: req.user.id, lessonId: lesson.id, completed: true },
        });

        const total = await prisma.lesson.count({ where: { courseId: lesson.courseId } });
        const done = await countCompletedInCourse(req.user.id, lesson.courseId);
        const progress = Math.round((done / total) * 100);

        await prisma.enrollment.update({
            where: {
                userId_courseId: { userId: req.user.id, courseId: lesson.courseId },
            },
            data: { progress, completed: progress === 100 },
        });

        let certificate = null;
        let wasCertificateNew = false;
        if (progress === 100) {
            const beforeCert = await prisma.certificate.findUnique({
                where: {
                    userId_courseId: {
                        userId: req.user.id,
                        courseId: lesson.courseId,
                    },
                },
            });
            certificate = await issueCertificateIfNeeded(req.user.id, lesson.courseId);
            wasCertificateNew = !beforeCert && !!certificate;
        }

        // ─── Геймификация (не блокирует ответ) ───
        if (!wasAlreadyCompleted) {
            onLessonCompleted(req.user.id, lesson.id).catch((e) =>
                console.error('[courses] gamif lesson:', e)
            );
        }
        if (wasCertificateNew && certificate) {
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

// ─── Отправка теста ─────────────────────────────────────────
router.post('/tests/:testId/submit', auth, async (req, res) => {
    try {
        const { answers } = req.body;
        const test = await prisma.test.findUnique({
            where: { id: req.params.testId },
            include: {
                questions: true,
                lesson: { include: { course: { include: { lessons: true } } } },
            },
        });
        if (!test) return res.status(404).json({ error: 'Тест не найден' });

        const enrollment = await prisma.enrollment.findUnique({
            where: {
                userId_courseId: {
                    userId: req.user.id,
                    courseId: test.lesson.courseId,
                },
            },
        });
        if (!enrollment) return res.status(403).json({ error: 'Не записаны на курс' });

        const completedLessonIds = await getCompletedLessonIds(req.user.id);

        const access = computeLessonAccess({
            course: test.lesson.course,
            lesson: test.lesson,
            enrollment,
            completedLessonIds,
        });
        if (!access.unlocked) {
            return res.status(403).json({ error: access.reason || 'Урок пока недоступен' });
        }

        let gained = 0;
        let max = 0;
        const wrongQuestions = [];

        for (const q of test.questions) {
            const userAnswer = answers ? answers[q.id] : undefined;
            const r = scoreQuestion(q, userAnswer);
            gained += r.gained;
            max += r.max;

            if (r.gained < r.max) {
                wrongQuestions.push({
                    id: q.id,
                    type: q.type,
                    text: q.text,
                    payload: sanitizePayload(q),
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
        let wasCertificateNew = false;

        if (passed) {
            // Проверяем, был ли урок уже пройден — чтобы не задвоить XP
            const existingProgress = await prisma.lessonProgress.findUnique({
                where: {
                    userId_lessonId: { userId: req.user.id, lessonId: test.lessonId },
                },
            });
            const wasAlreadyCompleted = existingProgress?.completed === true;

            // Урок автоматически помечается пройденным
            await prisma.lessonProgress.upsert({
                where: {
                    userId_lessonId: { userId: req.user.id, lessonId: test.lessonId },
                },
                update: { completed: true },
                create: {
                    userId: req.user.id,
                    lessonId: test.lessonId,
                    completed: true,
                },
            });

            const courseId = test.lesson.courseId;
            const total = await prisma.lesson.count({ where: { courseId } });
            const done = await countCompletedInCourse(req.user.id, courseId);
            const progress = Math.round((done / total) * 100);

            await prisma.enrollment.update({
                where: { userId_courseId: { userId: req.user.id, courseId } },
                data: { progress, completed: progress === 100 },
            });

            if (progress === 100) {
                const beforeCert = await prisma.certificate.findUnique({
                    where: { userId_courseId: { userId: req.user.id, courseId } },
                });
                certificate = await issueCertificateIfNeeded(req.user.id, courseId);
                wasCertificateNew = !beforeCert && !!certificate;
            }

            // ─── Геймификация: XP за тест + за урок (если впервые) + за сертификат ───
            onTestPassed(req.user.id, test.id, percent).catch((e) =>
                console.error('[courses] gamif test pass:', e)
            );
            if (!wasAlreadyCompleted) {
                onLessonCompleted(req.user.id, test.lessonId).catch((e) =>
                    console.error('[courses] gamif lesson:', e)
                );
            }
            if (wasCertificateNew && certificate) {
                onCertificateEarned(req.user.id, certificate.id).catch((e) =>
                    console.error('[courses] gamif cert:', e)
                );
            }
        } else {
            // Штраф за провал теста
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