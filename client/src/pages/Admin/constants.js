export const TABS = [
    ['dash', 'Дашборд', '📊'],
    ['analytics', 'Аналитика', '📈'],
    ['moderation', 'Модерация', '🛡️'],
    ['users', 'Пользователи', '👥'],
    ['courses', 'Курсы', '📚'],
    ['wiki', 'Wiki', '📖'],
    ['certificates', 'Сертификаты', '🏆'],
    ['broadcast', 'Рассылки', '📢'],
    ['push', 'Push-уведомления', '🔔'],
    ['bulk', 'Пакетные действия', '🛠'],
    ['site', 'Дизайн сайта', '🎨'],
    ['modules', 'Модули', '🧩'],
    ['backups', 'Бэкапы', '🗄️'],
    ['settings', 'Система', '⚙️'],
];

export const TEMPLATES = [
    { v: 'gradient', l: 'Градиент' },
    { v: 'classic', l: 'Классика (кремовый)' },
    { v: 'dark', l: 'Тёмный' },
    { v: 'minimal', l: 'Минимализм (белый)' },
];

export const QUESTION_TYPES = [
    { v: 'single', l: 'Один ответ' },
    { v: 'multiple', l: 'Несколько' },
    { v: 'matching', l: 'Соответствие' },
    { v: 'text', l: 'Текст' },
    { v: 'order', l: 'Порядок' },
];

export const CURRICULUM_TEMPLATE = [
    {
        slug: 'primer-kursa',
        title: 'Пример курса',
        description: 'Демонстрационный курс.',
        category: 'photo',
        level: 'beginner',
        published: true,
        lessons: [
            {
                title: 'Урок 1. Введение',
                content: 'Текст первого урока.',
                videoUrl: null,
                order: 1,
                duration: 15,
                test: {
                    title: 'Тест: Введение',
                    passScore: 70,
                    questions: [
                        { type: 'single', text: 'Пример?', payload: { options: ['A', 'B'], correct: 0 }, points: 1 },
                    ],
                },
            },
        ],
    },
];