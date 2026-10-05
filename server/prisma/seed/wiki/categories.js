/**
 * Определения категорий вики.
 * upsert по slug — существующие не затираются, обновляются только title/icon/order.
 */
export const WIKI_CATEGORIES = [
    {
        slug: 'photo',
        title: 'Фотография',
        description: 'Камера, свет, композиция, жанры.',
        icon: '📸',
        order: 1,
    },
    {
        slug: 'video',
        title: 'Видеосъёмка',
        description: 'От идеи до съёмки: сценарий, планы, стабилизация.',
        icon: '🎥',
        order: 2,
    },
    {
        slug: 'editing',
        title: 'Монтаж',
        description: 'Склейки, ритм, цвет, звук, экспорт.',
        icon: '🎬',
        order: 3,
    },
    {
        slug: 'radio',
        title: 'Радио и эфир',
        description: 'Жанры, эфир, интервью, подкасты.',
        icon: '📻',
        order: 4,
    },
    {
        slug: 'sound',
        title: 'Звукорежиссура',
        description: 'Запись, обработка, сведение, мастеринг.',
        icon: '🎚️',
        order: 5,
    },
    {
        slug: 'equipment',
        title: 'Оборудование',
        description: 'Как выбрать и как не сломать.',
        icon: '🛠️',
        order: 6,
    },
    {
        slug: 'rules',
        title: 'Правила медиацентра',
        description: 'Как всё устроено.',
        icon: '📋',
        order: 7,
    },
    {
        slug: 'glossary',
        title: 'Терминология',
        description: 'Словарь медийщика: короткие определения.',
        icon: '📖',
        order: 8,
    },
    {
        slug: 'career',
        title: 'Профессия и карьера',
        description: 'Фриланс, право, портфолио, выгорание.',
        icon: '💼',
        order: 9,
    },
];