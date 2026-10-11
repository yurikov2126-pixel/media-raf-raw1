# Файлы редакции и общий доступ

Разделы `/app/editorial/files` и `/app/editorial/shares` предназначены для руководителей редакции (роли ADMIN и MENTOR).

## Хранение

- Физические файлы: `server/uploads/editorial/` при запуске из `server/` (по умолчанию `uploads/editorial` относительно рабочей директории Node).
- Переопределение: `EDITORIAL_LIBRARY_DIR=/absolute/persistent/path`.
- Метаданные и ссылки: PostgreSQL, модели `EditorialLibraryFile` и `EditorialFileShare`.
- Путь `/uploads/editorial` намеренно закрыт от Express static. Просмотр и скачивание доступны **только через контролируемые API-маршруты**.
- Не сохраняйте файлы только внутри сменяемой директории релиза: настройте постоянный путь через `EDITORIAL_LIBRARY_DIR`, права на запись процесса Node и резервное копирование.
- Веб-сервер (Nginx) не должен напрямую раздавать `uploads/editorial` в обход Node. Проверьте правила `location /uploads/` на сервере.
- Лимит одного файла: 200 МБ; большие архивы (>4 ГБ в ZIP без ZIP64) необходимо скачивать отдельными файлами.

## API

Авторизованные: `GET/POST /api/editorial/library/files`, `GET/DELETE /api/editorial/library/files/:fileId`, `GET/POST /api/editorial/library/shares`, `POST /api/editorial/library/shares/:id/revoke`.

Публичные по непредсказуемому токену:
- `GET /api/editorial/library/public/:token` — сведения о подборке.
- `GET /api/editorial/library/public/:token/files/:fileId` — просмотр или скачивание.
- `GET /api/editorial/library/public/:token/archive` — потоковый ZIP.

Лендинг: `/share/editorial/:token`. Токен в ссылке предоставляет доступ ко всем выбранным файлам без регистрации. Ссылки можно ограничивать по сроку и отзывать. Не публикуйте их в открытом доступе.

## Развёртывание

1. Применить миграции: `npx prisma migrate deploy` из `server/`.
2. Настроить `EDITORIAL_LIBRARY_DIR` на постоянную директорию, доступную для записи Node.
3. Убедиться, что веб-сервер не отдаёт эту директорию напрямую.
4. Проверить загрузку, скачивание, предпросмотр, ZIP, истечение срока и отзыв ссылки.
5. Включить резервное копирование БД **и** каталога файлов: одного дампа БД недостаточно.
