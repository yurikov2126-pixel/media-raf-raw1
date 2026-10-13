# Предпросмотр ссылок (Telegram / VK)

У Media·RAF·RAW метаданные OG/Twitter рендерятся сервером для ботов в `server/src/routes/publicMeta.js`. Наличие `<meta>` в React после выполнения JavaScript не помогает большинству социальных роботов.

## Почему карточка могла не появляться
В production Nginx может отдавать `client/dist/index.html` напрямую. Тогда запрос `TelegramBot` не доходит до Express, где генерируется индивидуальная карточка. Другие причины: устаревший кеш мессенджера, недоступность `og:image`, редиректы/403, либо устаревшая версия кода на сервере.

## Развёртывание
1. Убедитесь, что backend с изменениями в `main` работает и отвечает на `/api/health`.
2. Если Nginx сам обслуживает SPA, адаптируйте `docs/nginx-social-preview.conf` к существующему виртуальному хосту; **не заменяйте всю конфигурацию**. Убедитесь, что не ломаются `/api/` и `/uploads/`.
3. Сохраните утверждённый JPG `1200×630` в `client/public/og/mediarafraw-cover-1200x630.jpg` и соберите/разверните клиент. Пока файла нет, сервер использует существующую иконку (см. код). Не указывайте ссылку на несуществующую обложку.
4. Проверьте: `nginx -t && systemctl reload nginx`.
5. Выполните проверки ниже.

## Проверки
```bash
curl -sSL -A 'TelegramBot (like TwitterBot)' https://mediarafraw.ru/ | grep -Ei 'og:(title|image|description)|twitter:card'
curl -sSL -A 'vkShare' https://mediarafraw.ru/share/editorial/VALID_TOKEN | grep -Ei 'og:(title|image|description)'
curl -sI https://mediarafraw.ru/og/mediarafraw-cover-1200x630.jpg
```
Замените `VALID_TOKEN` на действующую публичную ссылку. На последнем запросе ожидается HTTP 200 и `Content-Type: image/jpeg`. Изображение должно загружаться без авторизации. После проверки отправьте URL заново (или с новым нейтральным query-параметром для обхода кеша) и используйте VK Link Debugger / @WebpageBot в Telegram для обновления данных.

## Приватность
Предпросмотр внутренних разделов статичный, без пользовательских данных. Для `/share/editorial/:token` сервер проверяет срок и отзыв ссылки; имя подборки не должно утекать после закрытия доступа. Никогда не проксируйте HTML внутренних страниц пользователям как ботов без контроля ACL.
