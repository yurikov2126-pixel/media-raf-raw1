/**
 * Общие утилиты для всех админ-роутов.
 *
 * `safe` теперь — тонкая обёртка: ловит ошибку и передаёт в `next(err)`.
 * Вся логика маппинга (Prisma P2003/P2025/P2002 → HTTP-статусы, логирование)
 * вынесена в глобальный `errorHandler` (server/src/middleware/errorHandler.js).
 *
 * Оставлен как обёртка, чтобы не переписывать 60+ роутов разом.
 * В будущем можно удалить `safe` из роутов и полагаться на express-async-errors.
 */
export const safe = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};