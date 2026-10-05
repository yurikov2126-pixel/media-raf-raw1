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
import { lesson13 } from './lesson-13.js';

export const liveSound = {
    slug: 'koncertnaya-zvukorezhissura',
    title: 'Концертная звукорежиссура',
    description:
        'Полный курс для начинающего концертного звукорежиссёра: от оборудования и микрофонов до настройки пульта, работы с артистами и решения проблем в реальном времени. Теория, практика на концертах и обратная связь от руководителя. По итогам курса — именной сертификат.',
    category: 'sound',
    level: 'beginner',
    published: true,
    certificateTitle: 'Сертификат концертного звукорежиссёра MEDIA·RAF·RAW',
    certificateDescription:
        'Подтверждает прохождение курса «Концертная звукорежиссура» и владение техникой работы на живых концертах: настройка FOH-пульта, работа с мониторами, звук для зала и артистов.',
    lessons: [
        lesson01, lesson02, lesson03,
        lesson04, lesson05, lesson06,
        lesson07, lesson08, lesson09,
        lesson10, lesson11, lesson12,
        lesson13,
    ],
};