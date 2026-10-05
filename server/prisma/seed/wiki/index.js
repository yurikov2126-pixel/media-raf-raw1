import { WIKI_CATEGORIES } from './categories.js';
import { photoArticles } from './articles/photo.js';
import { videoArticles } from './articles/video.js';
import { editingArticles } from './articles/editing.js';
import { radioArticles } from './articles/radio.js';
import { soundArticles } from './articles/sound.js';
import { equipmentArticles } from './articles/equipment.js';
import { rulesArticles } from './articles/rules.js';
import { glossaryArticles } from './articles/glossary.js';
import { careerArticles } from './articles/career.js';

const ALL_ARTICLES = [
    ...photoArticles,
    ...videoArticles,
    ...editingArticles,
    ...radioArticles,
    ...soundArticles,
    ...equipmentArticles,
    ...rulesArticles,
    ...glossaryArticles,
    ...careerArticles,
];

/**
 * Идемпотентный seed вики.
 * Принимает PrismaClient снаружи, чтобы не создавать второй инстанс.
 *   - Категории: upsert по slug (обновляются title/description/icon/order).
 *   - Статьи: upsert по slug (обновляются title/excerpt/content/tags/published/categoryId).
 * Существующие статьи с другими slug не затрагиваются.
 */
export async function seedWiki(prisma) {
    console.log('\n=== Seed вики ===');

    // 1. Категории
    const catMap = new Map();
    for (const c of WIKI_CATEGORIES) {
        const saved = await prisma.wikiCategory.upsert({
            where: { slug: c.slug },
            update: {
                title: c.title,
                description: c.description,
                icon: c.icon,
                order: c.order,
            },
            create: {
                slug: c.slug,
                title: c.title,
                description: c.description,
                icon: c.icon,
                order: c.order,
            },
        });
        catMap.set(c.slug, saved.id);
    }
    console.log(`  категорий обработано: ${catMap.size}`);

    // 2. Статьи
    let created = 0;
    let updated = 0;
    for (const a of ALL_ARTICLES) {
        const categoryId = a.category ? catMap.get(a.category) : null;
        if (a.category && !categoryId) {
            console.warn(`  ⚠️ неизвестная категория «${a.category}» у статьи «${a.slug}»`);
            continue;
        }

        const data = {
            title: a.title,
            excerpt: a.excerpt || null,
            content: a.content,
            tags: JSON.stringify(Array.isArray(a.tags) ? a.tags : []),
            published: a.published !== undefined ? !!a.published : true,
            categoryId,
        };

        const existing = await prisma.wikiArticle.findUnique({
            where: { slug: a.slug },
            select: { id: true },
        });

        if (existing) {
            await prisma.wikiArticle.update({
                where: { slug: a.slug },
                data,
            });
            updated++;
        } else {
            await prisma.wikiArticle.create({
                data: { ...data, slug: a.slug },
            });
            created++;
        }
    }

    console.log(`  статей создано: ${created}, обновлено: ${updated}`);
    console.log('=== Вики готово ===');
}