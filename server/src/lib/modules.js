import { prisma } from './prisma.js';

/* Список модулей платформы.
   default — состояние, если в БД настройки нет. */
export const MODULES = [
    {
        key: 'feed',
        label: 'Лента',
        icon: '🏠',
        default: true,
        description: 'Публикации, комментарии, реакции',
    },
    {
        key: 'chats',
        label: 'Чаты',
        icon: '💬',
        default: true,
        description: 'Личные и групповые переписки',
    },
    {
        key: 'courses',
        label: 'Обучение',
        icon: '🎓',
        default: true,
        description: 'Курсы, уроки, тесты, сертификаты',
    },
    {
        key: 'wiki',
        label: 'База знаний',
        icon: '📖',
        default: true,
        description: 'Wiki-статьи и категории',
    },
];

export function getModuleKeys() {
    return MODULES.map((m) => m.key);
}

export async function getModulesState() {
    const settings = await prisma.setting.findMany({
        where: { key: { in: MODULES.map((m) => `module_${m.key}_enabled`) } },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    const result = {};
    for (const m of MODULES) {
        const value = map[`module_${m.key}_enabled`];
        result[m.key] = value === undefined ? m.default : value === 'true';
    }
    return result;
}

export async function isModuleEnabled(key) {
    const state = await getModulesState();
    return state[key] !== false;
}

export async function setModuleEnabled(key, enabled) {
    if (!getModuleKeys().includes(key)) throw new Error('Неизвестный модуль');
    const settingKey = `module_${key}_enabled`;
    const value = enabled ? 'true' : 'false';
    await prisma.setting.upsert({
        where: { key: settingKey },
        update: { value },
        create: { key: settingKey, value },
    });
}

/* Первый доступный модуль — используется для редиректа, когда текущий отключён. */
export async function getFirstEnabledModule() {
    const state = await getModulesState();
    for (const m of MODULES) {
        if (state[m.key]) return m;
    }
    return null;
}