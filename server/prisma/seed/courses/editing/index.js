import { lesson01 } from './lesson-01.js';
import { lesson02 } from './lesson-02.js';
import { lesson03 } from './lesson-03.js';
import { lesson04 } from './lesson-04.js';
import { lesson05 } from './lesson-05.js';
import { lesson06 } from './lesson-06.js';
import { lesson07 } from './lesson-07.js';
import { lesson08 } from './lesson-08.js';
import { lesson09 } from './lesson-09.js';
import { lesson10 } from './lesson-10.js';
import { lesson11 } from './lesson-11.js';
import { lesson12 } from './lesson-12.js';

export const editing = {
    slug: 'osnovy-montazha',
    title: 'Основы монтажа',
    description:
        'Полный курс для начинающего монтажёра: от языка кино и организации проекта до цветокоррекции, экспорта и портфолио. Теория, практика на реальных проектах и обратная связь от руководителя.',
    category: 'video',
    level: 'beginner',
    published: true,
    certificateTitle: 'Сертификат монтажёра MEDIA·RAF·RAW',
    certificateDescription:
        'Подтверждает прохождение курса «Основы монтажа» и владение техникой монтажа диалогов, репортажей и клипов, работой со звуком и цветокоррекцией.',
    lessons: [
        lesson01, lesson02, lesson03,
        lesson04, lesson05, lesson06,
        lesson07, lesson08, lesson09,
        lesson10, lesson11, lesson12,
    ],
};