import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

/**
 * Извлекает токен из запроса. Поддерживает два источника:
 *   1. Заголовок Authorization: Bearer <token>  (обычные API-запросы)
 *   2. Query-параметр ?token=<token>            (только GET для скачивания файлов)
 *
 * Токен из query разрешаем ТОЛЬКО для GET-запросов, чтобы не ослабить
 * защиту POST/PATCH/DELETE — их нельзя выполнить по простой ссылке.
 */
function extractToken(req) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
        return header.slice(7);
    }

    if (req.method === 'GET' && typeof req.query.token === 'string') {
        return req.query.token;
    }

    return null;
}

export async function auth(req, res, next) {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Нет токена' });

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({ where: { id: payload.id } });
        if (!user || user.isBanned) {
            return res.status(401).json({ error: 'Доступ закрыт' });
        }

        /*
         * Инвалидация старых токенов после смены пароля.
         *
         * Когда пользователь сбрасывает пароль через процедуру восстановления
         * (или меняет его через настройки), в User.passwordChangedAt пишется
         * текущее время. Все JWT, выпущенные ДО этого момента, должны стать
         * невалидными — на случай если у злоумышленника осталась старая сессия.
         *
         * payload.iat — Unix-время выпуска токена в СЕКУНДАХ (стандарт JWT).
         * passwordChangedAt — DateTime в миллисекундах.
         *
         * Запас 5 секунд — защита от рассинхрона: в момент смены пароля сам
         * процесс не должен выбивать свежевыпущенный токен, если клиент успел
         * получить его долей секунды раньше.
         */
        if (user.passwordChangedAt) {
            const passwordChangedMs = user.passwordChangedAt.getTime();
            const tokenIssuedMs = (payload.iat || 0) * 1000;

            if (tokenIssuedMs < passwordChangedMs - 5000) {
                return res
                    .status(401)
                    .json({ error: 'Сессия устарела, войдите заново' });
            }
        }

        req.user = user;
        next();
    } catch {
        res.status(401).json({ error: 'Неверный токен' });
    }
}

export const requireRole =
    (...roles) =>
        (req, res, next) =>
            roles.includes(req.user.role)
                ? next()
                : res.status(403).json({ error: 'Нет прав' });