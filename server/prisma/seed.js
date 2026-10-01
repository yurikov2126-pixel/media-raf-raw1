import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Сидирование настроек...');

    const settings = {
        // Брендинг
        site_name: 'MEDIA-RAF-RAW',
        site_description: 'Студенческий медиацентр',
        brand_logo_text: 'MEDIA·RAF·RAW',
        brand_logo_subtitle: 'Студенческий медиацентр',
        brand_accent_1: '#7C3AED',
        brand_accent_2: '#EC4899',
        brand_accent_3: '#06B6D4',

        // Лендинг
        landing_hero_badge: 'Студенческий медиацентр',
        landing_hero_title_prefix: 'Создаём',
        landing_hero_title_accent: 'контент',
        landing_hero_title_suffix: ', который цепляет',
        landing_hero_subtitle:
            'Платформа для студентов MEDIA-RAF-RAW: учись, снимай, монтируй, вещай на Radio Политех-FM, общайся с командой в одном месте.',
        landing_hero_cta_primary: 'Присоединиться →',
        landing_hero_cta_secondary: 'Что внутри',
        landing_features_title: 'Что мы делаем',
        landing_features: JSON.stringify([
            { icon: '📸', title: 'Фотосъёмка', text: 'Студийные и репортажные съёмки, обработка, цветокор.' },
            { icon: '🎥', title: 'Видеопродакшн', text: 'Съёмка, монтаж, цветокоррекция, звук.' },
            { icon: '📻', title: 'Radio Политех-FM', text: 'Эфиры, подкасты, интервью в студии.' },
            { icon: '🎚️', title: 'Звукорежиссура', text: 'Запись, сведение, мастеринг, работа с DAW.' },
        ]),
        landing_cta_title: 'Готов в эфир?',
        landing_cta_subtitle: 'Регистрируйся и становись частью команды',
        landing_cta_button: 'Создать аккаунт',

        // Меню
        nav_items: JSON.stringify([
            { to: '/app', label: 'Лента', end: true, icon: '🏠' },
            { to: '/app/chats', label: 'Чаты', icon: '💬' },
            { to: '/app/courses', label: 'Обучение', icon: '🎓' },
        ]),

        // Футер
        footer_description: 'MEDIA·RAF·RAW · Твоя медиа-команда',
        footer_copyright: '© MEDIA-RAF-RAW · Radio Политех-FM',
        footer_links: JSON.stringify([
            { label: 'VK', url: 'https://vk.com/mrr' },
            { label: 'Telegram', url: 'https://t.me/mrr' },
            { label: 'Почта', url: 'mailto:media@mrr.ru' },
        ]),

        // Контакты
        contact_email: 'media@mrr.ru',
        radio_stream_url: 'https://example.com/stream',
        vk_link: 'https://vk.com/mrr',
        tg_link: 'https://t.me/mrr',

        // Сертификаты
        certificate_template: 'gradient',
        certificate_accent_1: '#7C3AED',
        certificate_accent_2: '#EC4899',
        certificate_org_name: 'MEDIA·RAF·RAW',
        certificate_subtitle: 'Студенческий медиацентр',
        certificate_signature: 'Руководитель медиацентра',
    };

    for (const [key, value] of Object.entries(settings)) {
        await prisma.setting.upsert({
            where: { key },
            update: {},
            create: { key, value },
        });
    }

    console.log(`✅ Сохранено ключей настроек: ${Object.keys(settings).length}`);
    console.log('🎉 Готово!');
}

main()
    .catch((e) => {
        console.error('❌ Ошибка:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });