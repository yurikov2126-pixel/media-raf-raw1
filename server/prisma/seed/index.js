import { PrismaClient } from '@prisma/client';

import { photography } from './courses/photography/index.js';
// import { videography } from './courses/videography.js';
// import { editing } from './courses/editing.js';
// import { radio } from './courses/radio.js';
// import { studioSound } from './courses/studio-sound.js';
// import { liveSound } from './courses/live-sound.js';

const prisma = new PrismaClient();

const COURSES = [
    photography,
    // videography,
    // editing,
    // radio,
    // studioSound,
    // liveSound,
];

/**
 * Идемпотентный seed: удаляет все курсы и создаёт заново.
 * Всё, что связано с курсами (уроки, тесты, прогресс, сертификаты),
 * удаляется каскадно. Пользователи и остальные данные сохраняются.
 */
async function main() {
    console.log('=== Seed курсов ===');

    const courseCount = await prisma.course.count();
    if (courseCount > 0) {
        console.log(`Удаляем ${courseCount} курсов...`);
        await prisma.course.deleteMany({});
        console.log('OK');
    }

    for (const data of COURSES) {
        console.log(`\nКурс: ${data.title} (${data.slug})`);

        const course = await prisma.course.create({
            data: {
                slug: data.slug,
                title: data.title,
                description: data.description,
                cover: data.cover || null,
                category: data.category,
                level: data.level || 'beginner',
                published: data.published !== false,
                certificateTitle: data.certificateTitle || null,
                certificateDescription: data.certificateDescription || null,
                dripMode: data.dripMode || null,
                dripInterval: data.dripInterval || null,
            },
        });

        for (let i = 0; i < data.lessons.length; i++) {
            const l = data.lessons[i];
            const order = l.order ?? i + 1;

            const lesson = await prisma.lesson.create({
                data: {
                    courseId: course.id,
                    title: l.title,
                    content: l.content || '',
                    videoUrl: l.videoUrl || null,
                    order,
                    duration: l.duration ?? 0,
                    requiresPractical: !!l.practical,
                },
            });

            if (l.test) {
                const test = await prisma.test.create({
                    data: {
                        lessonId: lesson.id,
                        title: l.test.title || `Тест: ${l.title}`,
                        passScore: l.test.passScore ?? 70,
                    },
                });
                for (const q of l.test.questions || []) {
                    await prisma.question.create({
                        data: {
                            testId: test.id,
                            type: q.type || 'single',
                            text: q.text,
                            payload: JSON.stringify(q.payload || {}),
                            points: q.points ?? 1,
                        },
                    });
                }
            }

            if (l.practical) {
                await prisma.practicalWork.create({
                    data: {
                        lessonId: lesson.id,
                        courseId: course.id,
                        topic: l.practical.topic,
                        description: l.practical.description,
                        location: l.practical.location || null,
                        scheduledAt: null,
                        durationMin: l.practical.durationMin ?? 90,
                    },
                });
            }

            if (l.homework) {
                await prisma.homework.create({
                    data: {
                        lessonId: lesson.id,
                        title: l.homework.title,
                        description: l.homework.description,
                        maxFiles: l.homework.maxFiles ?? 3,
                        maxFileSizeMb: l.homework.maxFileSizeMb ?? 50,
                    },
                });
            }
        }

        console.log(`  уроков: ${data.lessons.length}`);
        console.log(`  практик: ${data.lessons.filter((l) => l.practical).length}`);
        console.log(`  ДЗ: ${data.lessons.filter((l) => l.homework).length}`);
    }

    console.log('\n=== Готово ===');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());