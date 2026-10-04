/* ─── XP-награды по умолчанию ─── */
export const XP_DEFAULTS = {
    post_created: 15,
    comment_created: 5,
    lesson_completed: 20,
    test_passed: 30,
    certificate_earned: 100,
    daily_login: 5,
    quest_completed_bonus: 0,
};

export const DEDUCTION_DEFAULTS = {
    post_deleted: 10,
    comment_deleted: 5,
    test_failed: 15,
    report_upheld: 25,
};

export const STREAK_BONUS = {
    per_day: 2,
    cap: 50,
};

export const MIN_COMMENT_LENGTH = 20;
export const LEVEL_MAX = 100;

/* ─── Уровни ─── */

/**
 * Базовая формула XP для уровня (используется как дефолт).
 * Level 1 = 0, Level 2 = 100, Level 3 = 300, Level 5 = 1000, Level 10 = 4500
 */
export function xpForLevel(level) {
    if (level <= 1) return 0;
    const n = Math.min(level, LEVEL_MAX);
    return 50 * (n - 1) * n;
}

/**
 * Дефолтные пороги для всех уровней.
 * Массив thresholds[i] = XP для уровня (i + 1).
 * thresholds[0] всегда 0.
 */
export const DEFAULT_LEVEL_THRESHOLDS = Array.from(
    { length: LEVEL_MAX },
    (_, i) => xpForLevel(i + 1)
);

/**
 * Уровень по XP с учётом кастомных порогов.
 * Пороги — массив длины N, thresholds[i] = минимальный XP для уровня (i + 1).
 */
export function levelFromXp(xp, thresholds = DEFAULT_LEVEL_THRESHOLDS) {
    if (xp <= 0) return 1;
    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (xp >= thresholds[i]) return i + 1;
    }
    return 1;
}

/**
 * Прогресс до следующего уровня.
 */
export function levelProgress(xp, thresholds = DEFAULT_LEVEL_THRESHOLDS) {
    const level = levelFromXp(xp, thresholds);
    const maxLevel = thresholds.length;

    if (level >= maxLevel) {
        return { level, current: 0, needed: 0, percent: 100, isMax: true, maxLevel };
    }

    const currentLevelXp = thresholds[level - 1];
    const nextLevelXp = thresholds[level];
    const current = Math.max(0, xp - currentLevelXp);
    const needed = nextLevelXp - currentLevelXp;
    const percent = needed > 0
        ? Math.min(100, Math.round((current / needed) * 100))
        : 100;

    return { level, current, needed, percent, isMax: false, maxLevel };
}

/* ─── Достижения ─── */

/**
 * Counter-based достижения — сидятся в БД при первом запуске.
 * Админ может их редактировать, добавлять новые, удалять.
 * Формат: id, title, description, icon, rarity, counter, threshold, order.
 */
export const DEFAULT_ACHIEVEMENTS = [
    /* Контент */
    { id: 'first_post', title: 'Первый пост', description: 'Опубликуйте первую запись', icon: '🎬', rarity: 'common', counter: 'postsCount', threshold: 1, order: 10 },
    { id: 'author_10', title: 'Автор', description: 'Опубликуйте 10 постов', icon: '📝', rarity: 'rare', counter: 'postsCount', threshold: 10, order: 20 },
    { id: 'producer_50', title: 'Продюсер', description: 'Опубликуйте 50 постов', icon: '🎥', rarity: 'epic', counter: 'postsCount', threshold: 50, order: 30 },
    { id: 'commentator_25', title: 'Комментатор', description: 'Напишите 25 комментариев', icon: '💬', rarity: 'common', counter: 'commentsCount', threshold: 25, order: 40 },
    { id: 'discussion_club', title: 'Дискуссионный клуб', description: 'Напишите 100 комментариев', icon: '🗣️', rarity: 'epic', counter: 'commentsCount', threshold: 100, order: 50 },
    { id: 'helper_20', title: 'Помощник', description: 'Оставьте 20 комментариев другим авторам', icon: '🤝', rarity: 'rare', counter: 'commentsOnOthers', threshold: 20, order: 60 },

    /* Обучение */
    { id: 'student_first', title: 'Студент', description: 'Пройдите первый урок', icon: '🎓', rarity: 'common', counter: 'lessonsCount', threshold: 1, order: 70 },
    { id: 'diligent_25', title: 'Прилежный', description: 'Пройдите 25 уроков', icon: '📚', rarity: 'rare', counter: 'lessonsCount', threshold: 25, order: 80 },
    { id: 'perfect_score', title: 'Отличник', description: 'Пройдите тест на 100%', icon: '💯', rarity: 'rare', counter: 'perfectTests', threshold: 1, order: 90 },
    { id: 'certified_first', title: 'Сертифицирован', description: 'Получите первый сертификат', icon: '🏆', rarity: 'rare', counter: 'certificatesCount', threshold: 1, order: 100 },
    { id: 'master_5', title: 'Мастер', description: 'Получите 5 сертификатов', icon: '👑', rarity: 'legendary', counter: 'certificatesCount', threshold: 5, order: 110 },

    /* Серии */
    { id: 'streak_3', title: 'Начало', description: 'Заходите 3 дня подряд', icon: '🌱', rarity: 'common', counter: 'streakCurrent', threshold: 3, order: 120 },
    { id: 'streak_7', title: 'Привычка', description: 'Заходите 7 дней подряд', icon: '🌿', rarity: 'rare', counter: 'streakCurrent', threshold: 7, order: 130 },
    { id: 'streak_30', title: 'Постоянство', description: 'Заходите 30 дней подряд', icon: '🌳', rarity: 'epic', counter: 'streakCurrent', threshold: 30, order: 140 },
    { id: 'streak_100', title: 'Легенда', description: 'Заходите 100 дней подряд', icon: '🏔️', rarity: 'legendary', counter: 'streakCurrent', threshold: 100, order: 150 },

    /* Уровни */
    { id: 'level_5', title: 'Пятый уровень', description: 'Достигните 5 уровня', icon: '⭐', rarity: 'common', counter: 'level', threshold: 5, order: 160 },
    { id: 'level_10', title: 'Десятый уровень', description: 'Достигните 10 уровня', icon: '🌟', rarity: 'rare', counter: 'level', threshold: 10, order: 170 },
    { id: 'level_25', title: 'Двадцать пятый', description: 'Достигните 25 уровня', icon: '💫', rarity: 'legendary', counter: 'level', threshold: 25, order: 180 },

    /* Квесты */
    { id: 'quest_first', title: 'Квест-мастер', description: 'Выполните первый ежедневный квест', icon: '⚔️', rarity: 'common', counter: 'questsCompleted', threshold: 1, order: 190 },
    { id: 'quest_10', title: 'Исполнитель', description: 'Выполните 10 ежедневных квестов', icon: '🗡️', rarity: 'rare', counter: 'questsCompleted', threshold: 10, order: 200 },
    { id: 'quest_50', title: 'Герой дня', description: 'Выполните 50 ежедневных квестов', icon: '🛡️', rarity: 'epic', counter: 'questsCompleted', threshold: 50, order: 210 },
    { id: 'quest_100', title: 'Легенда квестов', description: 'Выполните 100 ежедневных квестов', icon: '🏅', rarity: 'legendary', counter: 'questsCompleted', threshold: 100, order: 220 },
];

/**
 * Достижения на основе JS-функций. Их нельзя редактировать из админки
 * (не выразить через счётчик), но они показываются вместе с остальными.
 */
export const CODE_ACHIEVEMENTS = [
    {
        id: 'night_owl',
        title: 'Полуночник',
        description: 'Опубликуйте пост между 02:00 и 05:00',
        icon: '🌙',
        rarity: 'rare',
        order: 300,
        check: (ctx) => ctx.lastPostHour != null && ctx.lastPostHour >= 2 && ctx.lastPostHour < 5,
    },
    {
        id: 'early_bird',
        title: 'Ранняя пташка',
        description: 'Опубликуйте пост между 06:00 и 08:00',
        icon: '☀️',
        rarity: 'rare',
        order: 310,
        check: (ctx) => ctx.lastPostHour != null && ctx.lastPostHour >= 6 && ctx.lastPostHour < 8,
    },
];

export const ACHIEVEMENTS_MAP = Object.fromEntries(
    [...DEFAULT_ACHIEVEMENTS, ...CODE_ACHIEVEMENTS].map((a) => [a.id, a])
);

/* ─── Редкости ─── */
export const RARITIES = ['common', 'rare', 'epic', 'legendary'];

export const RARITY_COLORS = {
    common: '#94A3B8',
    rare: '#06B6D4',
    epic: '#7C3AED',
    legendary: '#EC4899',
};

export const RARITY_LABEL = {
    common: 'Обычное',
    rare: 'Редкое',
    epic: 'Эпическое',
    legendary: 'Легендарное',
};

/* ─── Доступные счётчики для достижений ─── */
export const COUNTER_OPTIONS = [
    { v: 'postsCount',        l: 'Количество постов' },
    { v: 'commentsCount',     l: 'Количество комментариев' },
    { v: 'commentsOnOthers',  l: 'Комментариев другим авторам' },
    { v: 'lessonsCount',      l: 'Пройдено уроков' },
    { v: 'perfectTests',      l: 'Тестов на 100%' },
    { v: 'certificatesCount', l: 'Получено сертификатов' },
    { v: 'streakCurrent',     l: 'Серия дней (текущая)' },
    { v: 'level',             l: 'Уровень' },
    { v: 'questsCompleted',   l: 'Выполнено квестов' },
];

/* ─── Квесты ─── */
export const DEFAULT_QUEST_TEMPLATES = [
    { type: 'post_count',          target: 1,  xpReward: 30,  label: 'Опубликуй пост',         icon: '📝', weight: 3 },
    { type: 'post_count',          target: 2,  xpReward: 60,  label: 'Опубликуй 2 поста',      icon: '📝', weight: 1 },
    { type: 'comment_count',       target: 3,  xpReward: 25,  label: 'Оставь 3 комментария',   icon: '💬', weight: 3 },
    { type: 'comment_count',       target: 5,  xpReward: 45,  label: 'Оставь 5 комментариев',  icon: '💬', weight: 2 },
    { type: 'comment_count',       target: 10, xpReward: 80,  label: 'Оставь 10 комментариев', icon: '💬', weight: 1 },
    { type: 'lesson_count',        target: 1,  xpReward: 40,  label: 'Пройди урок',            icon: '🎓', weight: 2 },
    { type: 'lesson_count',        target: 2,  xpReward: 75,  label: 'Пройди 2 урока',         icon: '🎓', weight: 1 },
    { type: 'test_pass',           target: 1,  xpReward: 60,  label: 'Сдай тест',              icon: '🧠', weight: 2 },
    { type: 'reaction_given',      target: 10, xpReward: 20,  label: 'Поставь 10 реакций',     icon: '❤️', weight: 3 },
    { type: 'reaction_given',      target: 20, xpReward: 35,  label: 'Поставь 20 реакций',     icon: '❤️', weight: 1 },
    { type: 'certificate_earned',  target: 1,  xpReward: 150, label: 'Получи сертификат',      icon: '🏆', weight: 1 },
];

export const QUEST_TEMPLATES = DEFAULT_QUEST_TEMPLATES;
export const ACHIEVEMENTS = [...DEFAULT_ACHIEVEMENTS, ...CODE_ACHIEVEMENTS];


export const QUEST_TYPE_META = {
    post_count:         { label: 'Посты',        icon: '📝' },
    comment_count:      { label: 'Комментарии',  icon: '💬' },
    lesson_count:       { label: 'Уроки',        icon: '🎓' },
    test_pass:          { label: 'Тесты',        icon: '🧠' },
    reaction_given:     { label: 'Реакции',      icon: '❤️' },
    certificate_earned: { label: 'Сертификаты',  icon: '🏆' },
};

/** Типы, считающиеся «обучающими» — используются для персональных квестов. */
export const LEARNING_QUEST_TYPES = ['lesson_count', 'test_pass', 'certificate_earned'];