import { prisma } from './prisma.js';

/**
 * Аналитика по курсам: воронка прохождения.
 *
 * Для каждого курса считает:
 *   - totalEnrolled       — сколько записались (за период или всего)
 *   - certificatesIssued  — сколько получили сертификат
 *   - completionRate      — процент завершивших
 *   - lessons[]           — массив по каждому уроку:
 *       reached           — сколько подошли к уроку (прошли хотя бы один предыдущий)
 *       theoryPassed      — сколько прошли тест/урок
 *       practicalPassed   — сколько принято практики (или null, если её нет)
 *       homeworkApproved  — сколько принято ДЗ (или null, если его нет)
 *       stuck             — reached − theoryPassed
 *   - dropoffPoints[]     — точки наибольшего отвала между уроками
 *
 * Параметр periodDays ограничивает выборку по дате enrollment.
 */

function startOfDayMinusDays(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Считает аналитику по всем курсам.
 * @param {object} opts
 * @param {number|null} opts.periodDays — если задано, ограничить по enrollment.createdAt
 */
export async function getCourseAnalytics({ periodDays = null } = {}) {
    const since = periodDays ? startOfDayMinusDays(periodDays) : null;

    // Все опубликованные и неопубликованные курсы — админ видит всё
    const courses = await prisma.course.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
            lessons: {
                orderBy: { order: 'asc' },
                select: {
                    id: true,
                    order: true,
                    title: true,
                    duration: true,
                    practical: { select: { id: true, topic: true } },
                    homework: { select: { id: true, title: true } },
                },
            },
        },
    });

    if (courses.length === 0) return [];

    // Все enrollments одним запросом
    const allCourseIds = courses.map((c) => c.id);
    const enrollments = await prisma.enrollment.findMany({
        where: {
            courseId: { in: allCourseIds },
            ...(since ? { createdAt: { gte: since } } : {}),
        },
        select: { id: true, userId: true, courseId: true },
    });

    // Сгруппируем enrollment по курсу
    const enrollmentsByCourse = new Map();
    for (const e of enrollments) {
        if (!enrollmentsByCourse.has(e.courseId)) enrollmentsByCourse.set(e.courseId, []);
        enrollmentsByCourse.get(e.courseId).push(e);
    }

    // Все LessonProgress по этим курсам (только completed=true)
    const allLessonIds = courses.flatMap((c) => c.lessons.map((l) => l.id));
    const allUserIds = [...new Set(enrollments.map((e) => e.userId))];

    const progresses = allUserIds.length && allLessonIds.length
        ? await prisma.lessonProgress.findMany({
            where: {
                userId: { in: allUserIds },
                lessonId: { in: allLessonIds },
                completed: true,
            },
            select: { userId: true, lessonId: true },
        })
        : [];

    // userId → Set(lessonId)
    const passedByUser = new Map();
    for (const p of progresses) {
        if (!passedByUser.has(p.userId)) passedByUser.set(p.userId, new Set());
        passedByUser.get(p.userId).add(p.lessonId);
    }

    // Практики и их сдачи
    const practicalIds = courses
        .flatMap((c) => c.lessons.map((l) => l.practical?.id))
        .filter(Boolean);

    const practicalSubmissions = practicalIds.length
        ? await prisma.practicalSubmission.findMany({
            where: {
                practicalId: { in: practicalIds },
                userId: { in: allUserIds },
                status: 'APPROVED',
            },
            select: { practicalId: true, userId: true },
        })
        : [];

    const approvedPracticalByUser = new Map(); // practicalId → Set(userId)
    for (const s of practicalSubmissions) {
        if (!approvedPracticalByUser.has(s.practicalId))
            approvedPracticalByUser.set(s.practicalId, new Set());
        approvedPracticalByUser.get(s.practicalId).add(s.userId);
    }

    // ДЗ и их сдачи
    const homeworkIds = courses
        .flatMap((c) => c.lessons.map((l) => l.homework?.id))
        .filter(Boolean);

    const homeworkSubmissions = homeworkIds.length
        ? await prisma.homeworkSubmission.findMany({
            where: {
                homeworkId: { in: homeworkIds },
                userId: { in: allUserIds },
                status: 'APPROVED',
            },
            select: { homeworkId: true, userId: true },
        })
        : [];

    const approvedHomeworkByUser = new Map(); // homeworkId → Set(userId)
    for (const s of homeworkSubmissions) {
        if (!approvedHomeworkByUser.has(s.homeworkId))
            approvedHomeworkByUser.set(s.homeworkId, new Set());
        approvedHomeworkByUser.get(s.homeworkId).add(s.userId);
    }

    // Сертификаты по курсам
    const certCounts = await prisma.certificate.groupBy({
        by: ['courseId'],
        where: {
            courseId: { in: allCourseIds },
            ...(since ? { issuedAt: { gte: since } } : {}),
        },
        _count: { _all: true },
    });
    const certMap = new Map(certCounts.map((c) => [c.courseId, c._count._all]));

    // Собираем результат
    const result = courses.map((course) => {
        const courseEnrollments = enrollmentsByCourse.get(course.id) || [];
        const totalEnrolled = courseEnrollments.length;
        const enrolledUserIds = new Set(courseEnrollments.map((e) => e.userId));

        const lessons = course.lessons;

        // reached(i) и theoryPassed(i)
        const reachedArr = [];
        const passedArr = [];
        for (let i = 0; i < lessons.length; i++) {
            // theoryPassed — сколько юзеров прошли урок i
            let passed = 0;
            for (const uid of enrolledUserIds) {
                const set = passedByUser.get(uid);
                if (set && set.has(lessons[i].id)) passed++;
            }
            passedArr.push(passed);

            // reached — сколько подошли к уроку i
            if (i === 0) {
                reachedArr.push(totalEnrolled);
            } else {
                // подошёл = прошёл хотя бы один из предыдущих уроков
                let reached = 0;
                for (const uid of enrolledUserIds) {
                    const set = passedByUser.get(uid);
                    if (!set) continue;
                    let ok = false;
                    for (let j = 0; j < i; j++) {
                        if (set.has(lessons[j].id)) {
                            ok = true;
                            break;
                        }
                    }
                    if (ok) reached++;
                }
                reachedArr.push(reached);
            }
        }

        const lessonsDetailed = lessons.map((l, i) => {
            let practicalPassed = null;
            if (l.practical) {
                const set = approvedPracticalByUser.get(l.practical.id);
                practicalPassed = set ? set.size : 0;
            }
            let homeworkApproved = null;
            if (l.homework) {
                const set = approvedHomeworkByUser.get(l.homework.id);
                homeworkApproved = set ? set.size : 0;
            }
            const reached = reachedArr[i];
            const theoryPassed = passedArr[i];
            return {
                order: l.order,
                title: l.title,
                duration: l.duration,
                reached,
                theoryPassed,
                practicalPassed,
                homeworkApproved,
                stuck: Math.max(0, reached - theoryPassed),
                hasPractical: !!l.practical,
                hasHomework: !!l.homework,
            };
        });

        // Точки отвала: между уроком i и i+1
        const dropoffPoints = [];
        for (let i = 0; i < lessons.length - 1; i++) {
            const from = reachedArr[i];
            const to = reachedArr[i + 1];
            const dropoff = Math.max(0, from - to);
            const dropoffPercent = from > 0 ? Math.round((dropoff / from) * 1000) / 10 : 0;
            dropoffPoints.push({
                fromOrder: lessons[i].order,
                toOrder: lessons[i + 1].order,
                fromTitle: lessons[i].title,
                toTitle: lessons[i + 1].title,
                reached: from,
                dropoff,
                dropoffPercent,
            });
        }

        // Топ-3 крупнейших отвала
        const topDropoffs = [...dropoffPoints]
            .sort((a, b) => b.dropoff - a.dropoff)
            .slice(0, 3);

        const certificatesIssued = certMap.get(course.id) || 0;
        const completionRate =
            totalEnrolled > 0
                ? Math.round((certificatesIssued / totalEnrolled) * 1000) / 10
                : 0;

        return {
            courseId: course.id,
            slug: course.slug,
            title: course.title,
            category: course.category,
            level: course.level,
            published: course.published,
            totalEnrolled,
            certificatesIssued,
            completionRate,
            lessonsTotal: lessons.length,
            lessons: lessonsDetailed,
            dropoffPoints,
            topDropoffs,
        };
    });

    // По убыванию числа записей
    result.sort((a, b) => b.totalEnrolled - a.totalEnrolled);

    return result;
}

/**
 * Сводка по платформе: агрегаты по всем курсам.
 */
export function buildSummary(coursesAnalytics) {
    const totalCourses = coursesAnalytics.length;
    const totalEnrolled = coursesAnalytics.reduce((s, c) => s + c.totalEnrolled, 0);
    const totalCertificates = coursesAnalytics.reduce((s, c) => s + c.certificatesIssued, 0);
    const avgCompletion =
        totalEnrolled > 0
            ? Math.round((totalCertificates / totalEnrolled) * 1000) / 10
            : 0;

    // Самый проблемный урок на платформе — по абсолютному отвалу
    const allDropoffs = coursesAnalytics.flatMap((c) =>
        c.dropoffPoints.map((d) => ({ ...d, courseTitle: c.title, courseSlug: c.slug }))
    );
    const worstDropoffs = [...allDropoffs]
        .sort((a, b) => b.dropoff - a.dropoff)
        .slice(0, 5);

    // Топ-5 курсов по completionRate (минимум 3 записавшихся)
    const topByCompletion = [...coursesAnalytics]
        .filter((c) => c.totalEnrolled >= 3)
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, 5);

    // Курсы с наибольшим «застреванием» (сумма stuck по всем урокам / totalEnrolled)
    const worstByStuck = [...coursesAnalytics]
        .filter((c) => c.totalEnrolled >= 3)
        .map((c) => {
            const totalStuck = c.lessons.reduce((s, l) => s + l.stuck, 0);
            const avgStuck = c.totalEnrolled > 0 ? totalStuck / c.totalEnrolled : 0;
            return { ...c, totalStuck, avgStuck };
        })
        .sort((a, b) => b.avgStuck - a.avgStuck)
        .slice(0, 5);

    return {
        totalCourses,
        totalEnrolled,
        totalCertificates,
        avgCompletion,
        worstDropoffs,
        topByCompletion,
        worstByStuck,
    };
}