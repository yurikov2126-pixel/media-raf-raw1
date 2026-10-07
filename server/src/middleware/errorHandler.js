/**
 * Глобальный обработчик ошибок Express.
 *
 * Сюда попадают все ошибки, которые роуты передали через `next(err)`.
 * Регистрируется в app.js последним middleware.
 *
 * Логика:
 *  - Prisma P2003 (нарушение FK)      → 409 "Связано с другими данными"
 *  - Prisma P2025 (запись не найдена) → 404 "Запись не найдена"
 *  - Prisma P2002 (уникальность)      → 409 "Такая запись уже существует"
 *  - err.status (кастомный)           → err.status + err.message
 *  - Всё остальное                    → 500 с err.message
 *
 * Ранее эта логика была продублирована в каждом роуте через обёртку `safe()`.
 * Теперь `safe()` только вызывает `next(err)`, а маппинг живёт здесь.
 */

export function errorHandler(err, req, res, _next) {
    // 1. Сначала маппинг известных Prisma-кодов в HTTP-статусы.
    if (err.code === 'P2003') {
        return res.status(409).json({ error: 'Связано с другими данными' });
    }
    if (err.code === 'P2025') {
        return res.status(404).json({ error: 'Запись не найдена' });
    }
    if (err.code === 'P2002') {
        return res.status(409).json({ error: 'Такая запись уже существует' });
    }

    if (err.status && err.status >= 400 && err.status < 600) {
        return res.status(err.status).json({ error: err.message || 'Ошибка' });
    }

    // 2. Всё, что дошло сюда — реально 5xx, логируем.
    console.error('[error]', req.method, req.originalUrl, err);
    res.status(500).json({ error: err.message || 'Внутренняя ошибка' });
}