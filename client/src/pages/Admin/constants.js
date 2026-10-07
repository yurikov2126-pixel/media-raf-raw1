export const TAB_GROUPS = [
    {
        key: 'overview',
        label: 'Обзор',
        tabs: [
            ['dash', 'Дашборд', '📊'],
            ['analytics', 'Аналитика', '📈'],
            ['actions', 'История действий', '📜'],
        ],
    },
    {
        key: 'people',
        label: 'Люди и модерация',
        tabs: [
            ['moderation', 'Модерация', '🛡️'],
            ['users', 'Пользователи', '👥'],
            ['password-resets', 'Восстановление', '🔑'],
        ],
    },
    {
        key: 'content',
        label: 'Контент',
        tabs: [
            ['courses', 'Курсы', '📚'],
            ['practicals-homework', 'Практики и ДЗ', '🎯'],
            ['wiki', 'Wiki', '📖'],
            ['certificates', 'Сертификаты', '🏆'],
        ],
    },
    {
        key: 'communications',
        label: 'Коммуникации',
        tabs: [
            ['broadcast', 'Рассылки', '📢'],
            ['push', 'Push-уведомления', '🔔'],
        ],
    },
    {
        key: 'platform',
        label: 'Платформа',
        tabs: [
            ['site', 'Дизайн сайта', '🎨'],
            ['modules', 'Модули', '🧩'],
            ['gamification', 'Геймификация', '🎮'],
            ['bulk', 'Пакетные действия', '🛠'],
        ],
    },
    {
        key: 'system',
        label: 'Система',
        tabs: [
            ['backups', 'Бэкапы', '🗄️'],
            ['settings', 'Настройки', '⚙️'],
        ],
    },
];

/* Плоский список — обратная совместимость.
   VALID_TABS, TAB_META и старые импорты продолжают работать. */
export const TABS = TAB_GROUPS.flatMap((g) => g.tabs);

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