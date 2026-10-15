import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { safe } from './_shared.js';

const router = Router();

function slugify(title) {
    return (
        String(title || '')
            .toLowerCase()
            .trim()
            .replace(/[^a-zа-я0-9\s-]/gi, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 60) +
        '-' +
        Date.now().toString(36).slice(-4)
    );
}

function parseArticle(a) {
    let tags = [];
    try { tags = JSON.parse(a.tags || '[]'); } catch {}
    return { ...a, tags };
}

/* ═══════════ WIKI ═══════════ */
router.get(
    '/wiki/categories',
    safe(async (_req, res) => {
        const cats = await prisma.wikiCategory.findMany({
            orderBy: { order: 'asc' },
            include: { _count: { select: { articles: true } } },
        });
        res.json(cats.map((c) => ({ ...c, articlesCount: c._count.articles })));
    })
);

router.post(
    '/wiki/categories',
    safe(async (req, res) => {
        const { title, description, icon, order, slug } = req.body;
        if (!title) return res.status(400).json({ error: 'Название обязательно' });
        const cat = await prisma.wikiCategory.create({
            data: {
                title,
                slug: slug || slugify(title),
                description: description || null,
                icon: icon || '📄',
                order: Number(order) || 0,
            },
        });
        res.json(cat);
    })
);

router.patch(
    '/wiki/categories/:id',
    safe(async (req, res) => {
        const allowed = ['title', 'slug', 'description', 'icon', 'order'];
        const data = {};
        for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
        if (data.order !== undefined) data.order = Number(data.order) || 0;
        const cat = await prisma.wikiCategory.update({
            where: { id: req.params.id },
            data,
        });
        res.json(cat);
    })
);

router.delete(
    '/wiki/categories/:id',
    safe(async (req, res) => {
        await prisma.wikiCategory.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

router.get(
    '/wiki/articles',
    safe(async (req, res) => {
        const { category, q } = req.query;
        const where = {};
        if (category) {
            const cat = await prisma.wikiCategory.findUnique({ where: { slug: category } });
            if (cat) where.categoryId = cat.id;
        }
        if (q) {
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { content: { contains: q, mode: 'insensitive' } },
            ];
        }

        const articles = await prisma.wikiArticle.findMany({
            where,
            orderBy: [{ updatedAt: 'desc' }],
            include: {
                category: { select: { id: true, slug: true, title: true, icon: true } },
                author: { select: { id: true, fullName: true, username: true } },
            },
        });
        res.json(articles.map(parseArticle));
    })
);

router.get(
    '/wiki/articles/:id',
    safe(async (req, res) => {
        const a = await prisma.wikiArticle.findUnique({
            where: { id: req.params.id },
            include: {
                category: { select: { id: true, slug: true, title: true, icon: true } },
                author: { select: { id: true, fullName: true, username: true } },
            },
        });
        if (!a) return res.status(404).json({ error: 'Статья не найдена' });
        res.json(parseArticle(a));
    })
);

router.post(
    '/wiki/articles',
    safe(async (req, res) => {
        const { title, slug, excerpt, content, cover, categoryId, tags, published } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'title и content обязательны' });
        }
        const article = await prisma.wikiArticle.create({
            data: {
                title,
                slug: slug || slugify(title),
                excerpt: excerpt || null,
                content,
                cover: cover || null,
                categoryId: categoryId || null,
                authorId: req.user.id,
                tags: JSON.stringify(Array.isArray(tags) ? tags : []),
                published: published !== undefined ? !!published : true,
            },
            include: {
                category: { select: { id: true, slug: true, title: true, icon: true } },
                author: { select: { id: true, fullName: true, username: true } },
            },
        });
        res.json(parseArticle(article));
    })
);

router.patch(
    '/wiki/articles/:id',
    safe(async (req, res) => {
        const allowed = ['title', 'slug', 'excerpt', 'content', 'cover', 'categoryId', 'published'];
        const data = {};
        for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
        if (req.body.tags !== undefined) {
            data.tags = JSON.stringify(Array.isArray(req.body.tags) ? req.body.tags : []);
        }
        if (data.published !== undefined) data.published = !!data.published;

        const article = await prisma.$transaction(async (tx) => {
            const before = await tx.wikiArticle.findUnique({ where: { id: req.params.id } });
            if (!before) return null;
            await tx.wikiRevision.create({ data: {
                articleId: before.id, editorId: req.user.id, title: before.title,
                excerpt: before.excerpt, content: before.content, cover: before.cover, tags: before.tags,
            } });
            return tx.wikiArticle.update({
            where: { id: req.params.id },
            data,
            include: {
                category: { select: { id: true, slug: true, title: true, icon: true } },
                author: { select: { id: true, fullName: true, username: true } },
            },
            });
        });
        if (!article) return res.status(404).json({ error: 'Статья не найдена' });
        res.json(parseArticle(article));
    })
);

router.delete(
    '/wiki/articles/:id',
    safe(async (req, res) => {
        await prisma.wikiArticle.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);


/* Идемпотентное наполнение справочника оборудования; не затрагивает существующие статьи. */
router.post('/wiki/seed-equipment', safe(async (req, res) => {
    const category = await prisma.wikiCategory.upsert({
        where: { slug: 'equipment-editorial' },
        update: {},
        create: { slug: 'equipment-editorial', title: 'Оборудование редакции',
            description: 'Камеры, звук, стабилизаторы, штативы и инструкции для команды', icon: '🎥', order: 10 },
    });
    const entries = [["sony-fdr-ax700","Sony FDR-AX700","Видеокамера редакции для репортажей, интервью и событий.","видеокамера","## Перед съёмкой\n- Проверьте заряд аккумулятора и запасной аккумулятор.\n- Установите карту памяти и убедитесь, что на ней достаточно места.\n- Проверьте разрешение, частоту кадров, баланс белого и экспозицию.\n- Запишите тестовый фрагмент и проверьте изображение и звук.\n\n## Во время съёмки\n- Следите за фокусировкой и уровнем звука.\n- Для длинных планов используйте штатив.\n- Снимайте общие, средние и крупные планы.\n\n## После съёмки\n- Скопируйте файлы в папку задания редакции и проверьте копию.\n- Только после проверки освобождайте карту памяти."],["canon-eos-m50","Canon EOS M50","Фотокамера редакции для репортажей, портретов и создания контента.","фотокамера","## Подготовка\n- Проверьте аккумулятор, карту памяти, объектив и чистоту оптики.\n- Выберите режим съёмки и проверьте ISO, выдержку и диафрагму.\n- Сделайте тестовый кадр и проверьте резкость.\n\n## Практика\n- Для репортажа снимайте разные планы, эмоции и детали.\n- При недостатке света контролируйте выдержку и смазывание.\n\n## После съёмки\n- Сохраните оригиналы в папку соответствующего задания и проверьте резервную копию."],["feiyutech-scorp-mini","FeiyuTech SCORP Mini","Стабилизатор редакции. Совместимость с конкретным смартфоном и креплением проверяйте перед установкой.","стабилизатор","## Перед использованием\n- Проверьте совместимость держателя и полезную нагрузку для вашей конфигурации.\n- Надёжно закрепите устройство и выполните балансировку по руководству.\n- Включайте моторы только после корректной балансировки.\n\n## Съёмка\n- Начните с плавной ходьбы и короткого тестового видео.\n- Не допускайте ударов и резких рывков.\n\n## После работы\n- Выключите питание, снимите устройство и аккуратно сложите стабилизатор."],["dji-mic-2","DJI Mic 2","Беспроводная микрофонная система для интервью и записи речи.","звук","## Подготовка\n- Проверьте заряд передатчиков и приёмника.\n- Убедитесь, что передатчик соединён с приёмником и звук поступает на записывающее устройство.\n- Закрепите микрофон так, чтобы одежда не создавала шорохов.\n\n## Проверка звука\n- Запишите пробную фразу и прослушайте её в наушниках.\n- Контролируйте уровень сигнала и перегрузку.\n\n## После записи\n- Проверьте полученные дорожки, сохраните исходники и поставьте устройства на зарядку."],["shure-reporter-microphone","Репортёрский микрофон Shure","Ручной микрофон редакции. Точная модель и тип подключения уточняются.","звук","## Подготовка\n- Уточните модель микрофона и совместимость разъёма с рекордером или камерой.\n- Проверьте кабель либо беспроводной тракт, если он используется.\n- Запишите короткий тест речи.\n\n## Интервью\n- Держите микрофон на комфортном расстоянии от говорящего.\n- Избегайте ударов по корпусу и трения кабеля.\n- Следите за уровнем сигнала.\n\n> Модель, схема подключения и особенности питания будут добавлены после инвентаризации."],["tripods-monopods","Штативы и моноподы редакции","Подборка опор для фото- и видеокамер. Конкретные модели пополняются по мере инвентаризации.","аксессуары","## Выбор опоры\n- Штатив подходит для статичных интервью, общих планов и длинных выдержек.\n- Монопод удобен, когда нужно быстро перемещаться между точками.\n\n## Перед установкой\n- Проверьте устойчивость опоры и допустимую нагрузку.\n- Надёжно закрепите площадку и камеру.\n- Не оставляйте установленную технику без присмотра.\n\n## После работы\n- Снимите камеру, сложите секции и проверьте фиксаторы.\n\n> Модели и характеристики будут уточнены после инвентаризации."]];
    let created = 0;
    for (const [slug, title, excerpt, kind, content] of entries) {
        const found = await prisma.wikiArticle.findUnique({ where: { slug } });
        if (found) continue;
        await prisma.wikiArticle.create({ data: {
            slug, title, excerpt, content, categoryId: category.id,
            authorId: req.user.id, published: true, tags: JSON.stringify(['оборудование', kind, 'редакция']),
        } });
        created++;
    }
    res.json({ ok: true, categoryId: category.id, created, total: entries.length });
}));

export default router;