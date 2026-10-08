# MEDIA·RAF·RAW

> Платформа студенческого медиацентра · Radio Политех-FM

Внутренняя платформа для команды студенческого медиацентра: лента публикаций, мессенджер, образовательные курсы с практиками и домашними заданиями, база знаний, система сертификатов, геймификация и модерация. Работает как SPA + PWA с офлайн-режимом.

---

## 📑 Оглавление

- [Возможности](#-возможности)
- [Стек технологий](#-стек-технологий)
- [Архитектура](#-архитектура)
- [Быстрый старт](#-быстрый-старт)
- [Локальная разработка с Docker](#-локальная-разработка-с-docker)
- [Переменные окружения](#-переменные-окружения)
- [Структура проекта](#-структура-проекта)
- [Работа с базой данных](#-работа-с-базой-данных)
- [Тестирование](#-тестирование)
- [Swagger / OpenAPI](#-swagger--openapi)
- [CI/CD](#-cicd)
- [Seed курсов](#-seed-курсов)
- [API](#-api)
- [PWA и офлайн-режим](#-pwa-и-офлайн-режим)
- [Cron-задачи](#-cron-задачи)
- [Деплой](#-деплой)
- [Роли пользователей](#-роли-пользователей)
- [Скрипты](#-скрипты)
- [Безопасность](#-безопасность)
- [Известные ограничения](#-известные-ограничения)

---

## ✨ Возможности

### Социальная часть
- **Лента публикаций** с медиа (фото/видео), реакциями и комментариями с вложенностью.
- **Профили пользователей**: аватар, обложка, био, соцсети, группа, направление, навыки.
- **Мессенджер** с личными и групповыми чатами, ответами, пересылками, реакциями, закреплёнными сообщениями, медиа, голосовыми с waveform, поиском, индикатором «печатает».

### Обучение
- **Курсы** с уроками, тестами и drip-режимом.
- **Практические занятия** с руководителем: тема, дата, длительность.
- **Домашние задания** с комбинированной сдачей (текст + ссылка + файлы).
- **Разблокировка уроков** по цепочке: следующий урок не откроется, пока практика не одобрена руководителем.
- **Сертификаты** с уникальным серийным номером, QR-кодом и PDF-экспортом.
- **Публичная проверка** сертификатов по ссылке `/verify/:serial`.

### База знаний
- **Wiki** с категориями, статьями, тегами, поиском, хлебными крошками.
- Полноценный markdown-редактор в админке с превью.

### Геймификация
- **XP и уровни** с настраиваемыми порогами.
- **Достижения** (редактируются через админку).
- **Ежедневные квесты** — индивидуальные для каждого студента.
- **Серии дней** (streak) с бонусами.
- **Лидерборд** по неделе и за всё время.
- **Уведомления** о level-up, достижениях и штрафах.
- **Устойчивость к гонкам**: все операции начисления/списания XP корректно обрабатывают удаление пользователя во время выполнения (`P2025`/`P2003`).

### Модерация
- **Жалобы** на посты, комментарии, сообщения, пользователей.
- **Автомодерация** при множественных жалобах.
- **Восстановление пароля** через код от администратора.

### Платформа
- **Модульная система** — разделы включаются/выключаются из админки.
- **Онбординг** — короткий тур для новых пользователей и при добавлении новых фич.
- **Тёмная и светлая** темы.
- **PWA** с офлайн-режимом, splash-экраном и push-уведомлениями.
- **Админ-панель** с полным управлением: пользователи, курсы, wiki, сертификаты, бэкапы, аналитика, пакетные операции. Разбита на 25 модульных подроутеров (см. `server/src/routes/admin/`).
- **Дашборд-2.0** — sparklines, quick actions, recent activity из журнала аудита, alerts по здоровью сервера.
- **Command palette (⌘K / Ctrl+K)** — быстрый переход между разделами и глобальный поиск по users/courses/posts/certificates/wiki.
- **Undo-удаление** — 30-секундное окно отмены для пользователей и постов с записью в журнал аудита.
- **История действий админов** — все операции пишутся в `AdminAction` с фильтрами, пагинацией и раскрывающимся payload.

### Качество и автоматизация
- **173 интеграционных теста** (Vitest + Supertest) для API: auth, posts, users, moderation, backups, modules, actions, maintenance, search.
- **Глобальный error handler** — все Prisma-коды (P2002/P2003/P2025) маппятся в HTTP-статусы в одном месте (`server/src/middleware/errorHandler.js`), а `safe()` стал тонкой обёрткой над `next(err)`.
- **GitHub Actions CI** — линт, тесты и сборка на каждый push и PR. Зелёный CI блокирует мерж красного PR.
- **Автоматический деплой** через self-hosted runner: `git push` в `main` → деплой на прод за ~1 минуту.
- **Ручной деплой в одну команду** — `bash scripts/deploy.sh` (бэкап БД → git pull → зависимости → миграция схемы → перезапуск → сборка клиента → healthcheck).
- **Prisma migrate** с baseline-миграцией — история изменений схемы под контролем.
- **ESLint (flat config)** — 0 ошибок, `ignoreRestSiblings` и `allowEmptyCatch` включены.

---

## 🛠 Стек технологий

### Backend
| Технология | Назначение |
|---|---|
| **Node.js** (ESM) | Серверная среда (≥ 22) |
| **Express** | HTTP-сервер |
| **Prisma** | ORM |
| **PostgreSQL** | Основная БД |
| **Socket.IO** | Реальное время (чаты, typing, уведомления) |
| **JWT + bcrypt** | Аутентификация |
| **Multer + Sharp** | Загрузка и обработка изображений |
| **ffmpeg** | Генерация waveform для голосовых |
| **node-cron** | Фоновые задачи |
| **web-push** | Push-уведомления |
| **pg_dump 18** | Резервное копирование БД |
| **swagger-jsdoc** (`7.0.0-rc.6`) | Генерация OpenAPI spec из JSDoc-аннотаций |
| **swagger-ui-express** | Интерактивный UI для документации API |

### Backend — качество и тесты
| Технология | Назначение |
|---|---|
| **Vitest 5** | Тест-раннер (ESM, быстрый) |
| **Supertest** | HTTP-тесты против Express-приложения |
| **ESLint 9** | Линтер (flat config, 0 warnings) |
| **Prettier** | Форматирование |

### Frontend
| Технология | Назначение |
|---|---|
| **React 18** | UI |
| **Vite 5** | Сборка |
| **React Router** | Маршрутизация |
| **Tailwind CSS** | Стилизация |
| **Framer Motion** | Анимации (минимально) |
| **Socket.IO Client** | Реальное время |
| **Recharts** | Графики в админке |
| **react-easy-crop** | Обрезка изображений |
| **qrcode.react** | QR-коды сертификатов |
| **html-to-image + jsPDF** | PDF-экспорт сертификатов |
| **vite-plugin-pwa** | PWA и Service Worker |

### Инфраструктура
| Технология | Назначение |
|---|---|
| **Docker Compose** | Локальный PostgreSQL для разработки и тестов |
| **GitHub Actions** | CI (тесты, линт, сборка) |
| **GitHub Actions self-hosted runner** | CD: запуск деплоя прямо на сервере |
| **systemd** | Процесс-менеджер на сервере (`mediaraf-api.service`) |
| **Nginx** | Реверс-прокси, SSL, раздача SPA |
| **aaPanel** | Панель управления сервером (nginx, PostgreSQL, SSL) |

---

## 🏗 Архитектура

```
┌─────────────────┐         ┌──────────────────┐
│   React SPA     │◄───────►│   Express API    │
│  (Vite build)   │  HTTP   │   + Socket.IO    │
│                 │◄───────►│                  │
│  · Router       │   WS    │  · JWT auth      │
│  · Contexts     │         │  · Prisma ORM    │
│  · PWA + SW     │         │  · Uploads       │
└─────────────────┘         └────────┬─────────┘
                                     │
                            ┌────────▼─────────┐
                            │   PostgreSQL     │
                            │  + uploads/ на   │
                            │    диске         │
                            └──────────────────┘
```

**Ключевые принципы:**
- **Клиент и сервер разделены.** Клиент знает только `VITE_API` и `VITE_SOCKET`.
- **Аутентификация через JWT.** Токен хранится в `localStorage` (mrr_token). После смены пароля все старые токены инвалидируются через `passwordChangedAt`.
- **Express-приложение отделено от запуска сервера.** `src/app.js` создаёт и настраивает `app` (без `listen`), `src/index.js` поднимает HTTP-сервер, Socket.IO и cron-задачи. Такое разделение позволяет тестировать API через Supertest без запуска реального сервера.
- **Глобальный error handler.** `src/middleware/errorHandler.js` — единая точка для всех ошибок роутов. Prisma-коды `P2003` → 409, `P2025` → 404, `P2002` → 409, `err.status` пробрасывается как есть, остальное → 500. Роуты оборачиваются в `safe(fn)` из `routes/admin/_shared.js`, который просто зовёт `Promise.resolve(fn()).catch(next)`. Бизнес-логика в `lib/` больше не думает про HTTP-статусы — она бросает ошибки через `Object.assign(new Error(msg), { status })`, а хендлер сам разбирается.
- **Модульная админка.** Бывший монолит `routes/admin.js` (~1400 строк) разбит на 25 подроутеров в `routes/admin/` (`users.js`, `courses.js`, `moderation.js`, `backups.js`, `bulk.js`, `wiki.js`, `push.js`, `gamification.js`, `practicals.js`, `homework.js`, `actions.js`, `dashboard.js`, `search.js`, `undo.js`, `system.js` и т.д.). `routes/admin.js` — тонкий barrel (5 строк). Префикс `/api/admin` и middleware `auth + requireRole('ADMIN')` вешаются один раз в `routes/admin/index.js`.
- **Swagger генерируется из кода.** `src/docs/swagger.js` собирает OpenAPI 3.0.3 spec из JSDoc-блоков `@openapi` прямо над роутами. Покрытие можно наращивать постепенно: покрыл роут — появился в UI. Готовый spec отдаётся на `/api/docs.json`, UI — на `/api/docs`.
- **Prisma migrate, а не db push.** Схема версионируется через миграции. Первая миграция `0_init` — baseline для уже существующей БД.
- **Отложенное удаление.** `lib/pendingDeletion.js` реализует soft-delete-окно в 30 секунд через таблицу `PendingDeletion`. Роут `DELETE /admin/users/:id` не удаляет сразу, а ставит задачу в очередь и возвращает `undoToken`. Воркер `processPendingDeletions()` раз в 30 секунд подчищает просроченные. Отмена — `POST /admin/undo/:token`.
- **Socket.IO** используется для чатов, typing-индикатора, уведомлений в реальном времени.
- **PWA** работает офлайн: precache HTML/JS/CSS, кеш `/uploads`, офлайн-экран при отсутствии сети.
- **systemd, а не pm2.** API запускается как системный сервис `mediaraf-api.service`, что даёт автозапуск после ребута, рестарт при падении и единый способ управления из CI/скриптов.
- **Self-hosted GitHub Actions runner.** Раннер установлен на самом сервере (исходящее соединение к GitHub по HTTPS). Пуш в `main` запускает деплой локально, без SSH извне.

---

## 🚀 Быстрый старт

### Требования

- **Node.js** ≥ 22
- **PostgreSQL** ≥ 14 (на проде — 18), либо **Docker** для локальной разработки
- **ffmpeg** (для waveform голосовых)
- **pg_dump / pg_restore** от версии сервера БД (для бэкапов)

### Установка

```bash
# 1. Клонировать репозиторий
git clone https://github.com/yurikov2126-pixel/media-raf-raw1.git
cd media-raf-raw1

# 2. Установить зависимости сервера
cd server
npm install

# 3. Установить зависимости клиента
cd ../client
npm install
```

> ⚠️ **Проблема с npm-зеркалами.** Некоторые панели управления (например, aaPanel) ставят глобально китайское зеркало `registry.npmmirror.com`, где периодически отсутствуют свежие пакеты (`electron-to-chromium` и др.). Если `npm ci` падает с `E404`, выполните:
> ```bash
> npm config set registry https://registry.npmjs.org/
> npm cache clean --force
> ```
> Скрипт `scripts/deploy.sh` уже делает это автоматически.

### Настройка БД

Если у вас свой Postgres — создайте базу:

```bash
sudo -u postgres psql <<'EOF'
CREATE DATABASE media_raf_raw
  WITH ENCODING='UTF8'
  LC_COLLATE='C.UTF-8'
  LC_CTYPE='C.UTF-8';
CREATE USER media_raf_raw WITH ENCRYPTED PASSWORD 'ваш_пароль';
GRANT ALL PRIVILEGES ON DATABASE media_raf_raw TO media_raf_raw;
\c media_raf_raw
GRANT ALL ON SCHEMA public TO media_raf_raw;
ALTER SCHEMA public OWNER TO media_raf_raw;
\q
EOF
```

Если Docker — см. секцию [Локальная разработка с Docker](#-локальная-разработка-с-docker).

### Миграции и запуск

```bash
# 1. Применить миграции к основной БД
cd server
npx prisma migrate deploy
npx prisma generate

# 2. Запустить сервер (dev)
npm run dev

# 3. В отдельном терминале — клиент
cd ../client
npm run dev
```

Открыть **http://localhost:5173** (клиент) и **http://localhost:4000/api/docs** (Swagger UI).

---

## 🐳 Локальная разработка с Docker

Для локальной разработки используется отдельный Postgres в контейнере — изолированно от системного и прод-БД.

### `docker-compose.dev.yml` (в корне репо)

```yaml
services:
  postgres-dev:
    image: postgres:16-alpine
    container_name: media-raf-raw-postgres-dev
    restart: unless-stopped
    ports:
      - "5434:5432"
    environment:
      POSTGRES_USER: media_raf_raw
      POSTGRES_PASSWORD: dev_password_local
      POSTGRES_DB: media_raf_raw_dev
    volumes:
      - media_raf_raw_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U media_raf_raw"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  media_raf_raw_pgdata:
```

**Почему 5434, а не 5432:** на Mac часто уже стоит Postgres (Homebrew, Postgres.app). 5434 = «мой тестовый, не тронь системный».

### Запуск

```bash
# 1. Из корня репо
docker compose -f docker-compose.dev.yml up -d

# 2. Проверить, что поднялся
docker ps | grep postgres-dev
# должно быть: Up ... (healthy)

# 3. Перейти в server
cd server

# 4. Скопировать шаблоны env
cp .env.test.example .env.test
cp .env.test.example .env.local

# 5. Накатить миграции
npm run db:migrate

# 6. Запустить дев-сервер
npm run dev
```

### Особенности окружений

- **`server/.env`** — для локальной разработки (указывает на Docker 5434). На проде **другой** `.env`, он живёт только на сервере.
- **`server/.env.test`** — для тестов. Читается через `loadEnv({ path: '.env.test', override: true })` в `vitest.config.js`, а не через стандартный `dotenv/config` (иначе бы подхватился `.env` и увёл тесты в прод-БД).
- **`server/.env.local`** — для `npm run dev` (передаётся через `node --env-file=.env.local`).
- **Sanity-check в `tests/setup.js`** — если `DATABASE_URL` не задан или (локально, при `CI !== true`) указывает на порт 5432, тесты падают с понятным сообщением. В CI (`process.env.CI === 'true'`) проверка порта пропускается, потому что GitHub Actions поднимает Postgres как service именно на 5432.

---

## 🔐 Переменные окружения

Создайте `server/.env` (см. также `server/.env.example`):

```env
DATABASE_URL="postgresql://media_raf_raw:пароль@localhost:5432/media_raf_raw?schema=public"
JWT_SECRET="сгенерируйте-через-openssl-rand-base64-32"
PUBLIC_URL="https://mediarafraw.ru"
PORT=4000
NODE_ENV=production

# VAPID (для push-уведомлений)
VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:admin@mediarafraw.ru"

# Опционально:
# MRR_PG_DUMP_PATH=/www/server/pgsql/bin/pg_dump
# MRR_PG_RESTORE_PATH=/www/server/pgsql/bin/pg_restore
# FFMPEG_PATH=/usr/bin/ffmpeg
# PUSH_CLEANUP_CRON="0 4 * * *"
# NOTIFY_CLEANUP_CRON="30 4 * * *"
# PASSWORD_RESET_CLEANUP_CRON="45 4 * * *"
# GAMIFICATION_INACTIVITY_CRON="0 5 * * *"
# ACTION_CLEANUP_CRON="0 6 * * *"
```

Создайте `server/.env.test` для интеграционных тестов (в git лежит `server/.env.test.example`):

```env
DATABASE_URL="postgresql://media_raf_raw:dev_password_local@localhost:5434/media_raf_raw_dev?schema=public"
JWT_SECRET="test-secret-do-not-use-in-prod"
NODE_ENV="test"
```

> ⚠️ **Важно:** тесты пишут данные в БД. Никогда не запускайте их против продакшн-базы. Всегда используйте отдельную тестовую БД (или Docker-контейнер).

Создайте `server/.env.local` для локальной разработки (обычно = `.env`, если оба указывают на Docker):

```env
DATABASE_URL="postgresql://media_raf_raw:dev_password_local@localhost:5434/media_raf_raw_dev?schema=public"
JWT_SECRET="dev-secret-local-only"
NODE_ENV="development"
CLIENT_URL="http://localhost:5173"
PORT=4000
```

Создайте `client/.env`:

```env
VITE_API="http://localhost:4000/api"
VITE_SOCKET="http://localhost:4000"
```

> 🔒 `.env`, `.env.test`, `.env.local` **не в git**. Если случайно закоммитили — немедленно отзовите секреты и удалите файл из истории.

> 💡 **Локальные prisma-команды.** Prisma по умолчанию читает `server/.env` (прод-URL). Чтобы не переключать файлы вручную, используйте алиас в `~/.zshrc`:
> ```zsh
> alias prisma-local='DATABASE_URL="postgresql://media_raf_raw:dev_password_local@localhost:5434/media_raf_raw_dev?schema=public" npx prisma'
> ```
> Тогда `prisma-local migrate dev --name add_something`, `prisma-local studio`, `prisma-local migrate status` — все пойдут в Docker-БД.

---

## 📁 Структура проекта

```
media-raf-raw1/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                             # CI: lint + tests + build на push/PR
│       └── deploy.yml                         # CD: деплой через self-hosted runner
│
├── scripts/                                   # Общие скрипты
│   └── deploy.sh                              # Деплой в одну команду
│
├── docker-compose.dev.yml                     # Локальный Postgres для разработки и тестов
│
├── client/                                    # ─── React + Vite (SPA + PWA)
│   │
│   ├── public/                                # Статика
│   │   ├── favicon.svg
│   │   ├── favicon-16.png
│   │   ├── favicon-32.png
│   │   ├── apple-touch-icon.png
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   ├── icon-maskable.svg
│   │   └── robots.txt
│   │
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js
│   │   │
│   │   ├── components/
│   │   │   ├── messenger/
│   │   │   │   ├── MessageBubble.jsx
│   │   │   │   ├── GroupAvatar.jsx
│   │   │   │   ├── NewChatButton.jsx
│   │   │   │   └── MessengerNavMenu.jsx
│   │   │   │
│   │   │   ├── Layout.jsx
│   │   │   ├── MobileNav.jsx
│   │   │   ├── Avatar.jsx
│   │   │   ├── NotificationBell.jsx
│   │   │   ├── NetworkBanner.jsx
│   │   │   ├── ThemeToggle.jsx
│   │   │   ├── SplashScreen.jsx
│   │   │   ├── OfflineScreen.jsx
│   │   │   ├── OnboardingModal.jsx
│   │   │   │
│   │   │   ├── PostCard.jsx
│   │   │   ├── PostReactions.jsx
│   │   │   ├── CommentSection.jsx
│   │   │   ├── ReportButton.jsx
│   │   │   ├── MessageText.jsx
│   │   │   │
│   │   │   ├── VoicePlayer.jsx
│   │   │   ├── VoiceRecorder.jsx
│   │   │   ├── ImageViewer.jsx
│   │   │   ├── ImageCropper.jsx
│   │   │   ├── MediaGalleryModal.jsx
│   │   │   ├── ProfileEditor.jsx
│   │   │   ├── ChangePasswordModal.jsx
│   │   │   ├── MentionSuggest.jsx
│   │   │   ├── PinnedBar.jsx
│   │   │   │
│   │   │   ├── LevelBadge.jsx
│   │   │   ├── XpProgressBar.jsx
│   │   │   ├── AchievementCard.jsx
│   │   │   ├── AchievementToast.jsx
│   │   │   ├── QuestCard.jsx
│   │   │   │
│   │   │   └── Admin/
│   │   │       ├── ConfirmDialog.jsx
│   │   │       └── SearchSelect.jsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── usePageMeta.js
│   │   │   ├── usePostDraft.js
│   │   │   ├── usePullToRefresh.js
│   │   │   └── useLocalStorage.js
│   │   │
│   │   ├── lib/
│   │   │   ├── modalStack.js
│   │   │   └── push.js
│   │   │
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Feed.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── Messenger.jsx
│   │   │   ├── Notifications.jsx
│   │   │   ├── Leaderboard.jsx
│   │   │   ├── Courses.jsx
│   │   │   ├── CourseView.jsx
│   │   │   ├── Certificate.jsx
│   │   │   ├── Verify.jsx
│   │   │   ├── Wiki.jsx
│   │   │   ├── WikiArticle.jsx
│   │   │   │
│   │   │   └── Admin/
│   │   │       ├── index.jsx
│   │   │       ├── constants.js
│   │   │       ├── utils.js
│   │   │       ├── components/
│   │   │       │   ├── ConfirmDialog.jsx
│   │   │       │   ├── SearchSelect.jsx
│   │   │       │   ├── AdminSidebar.jsx         # Группированное меню
│   │   │       │   ├── AdminSkeleton.jsx        # Skeleton при загрузке lazy-таба
│   │   │       │   ├── AdminCommandPalette.jsx  # ⌘K-палитра
│   │   │       │   ├── OrphanFilesList.jsx      # Детализация осиротевших файлов
│   │   │       │   ├── SparklineCard.jsx        # Мини-графики
│   │   │       │   ├── QuickActions.jsx         # Плитки-переходы
│   │   │       │   ├── RecentActivity.jsx       # Последние AdminAction
│   │   │       │   └── AlertsBanner.jsx         # Предупреждения по здоровью сервера
│   │   │       └── tabs/
│   │   │           ├── Dashboard.jsx            # + Sparklines, QuickActions, RecentActivity, Alerts
│   │   │           ├── Analytics.jsx
│   │   │           ├── Users.jsx
│   │   │           ├── Certificates.jsx
│   │   │           ├── Broadcast.jsx
│   │   │           ├── Push.jsx
│   │   │           ├── Backups.jsx
│   │   │           ├── Moderation.jsx
│   │   │           ├── PasswordResets.jsx
│   │   │           ├── Modules.jsx
│   │   │           ├── Settings.jsx
│   │   │           ├── Gamification.jsx
│   │   │           ├── PracticalsHomework.jsx
│   │   │           ├── Actions.jsx              # История действий + автоочистка
│   │   │           │
│   │   │           ├── Courses/
│   │   │           │   ├── index.jsx
│   │   │           │   ├── CourseEditor.jsx
│   │   │           │   ├── LessonEditor.jsx
│   │   │           │   ├── PracticalEditor.jsx
│   │   │           │   ├── HomeworkEditor.jsx
│   │   │           │   ├── TestEditor.jsx
│   │   │           │   └── QuestionEditor.jsx
│   │   │           │
│   │   │           ├── Wiki/
│   │   │           │   ├── index.jsx
│   │   │           │   ├── CategoryEditor.jsx
│   │   │           │   └── ArticleEditor.jsx
│   │   │           │
│   │   │           ├── Bulk/
│   │   │           │   ├── index.jsx
│   │   │           │   ├── RecalcUserCourseForm.jsx
│   │   │           │   ├── BulkCourseAction.jsx
│   │   │           │   └── CurriculumImportForm.jsx
│   │   │           │
│   │   │           └── SiteDesign/
│   │   │               ├── index.jsx
│   │   │               ├── BrandEditor.jsx
│   │   │               ├── LandingEditor.jsx
│   │   │               ├── MenuEditor.jsx
│   │   │               ├── FooterEditor.jsx
│   │   │               ├── CertificateEditor.jsx
│   │   │               └── ThemeEditor.jsx
│   │   │
│   │   ├── stickers/
│   │   │   └── pack.jsx
│   │   │
│   │   ├── store/
│   │   │   ├── auth.jsx
│   │   │   ├── socket.jsx
│   │   │   ├── notifications.jsx
│   │   │   ├── settings.jsx
│   │   │   ├── modules.jsx
│   │   │   ├── onboarding.jsx
│   │   │   ├── theme.jsx
│   │   │   ├── network.jsx
│   │   │   ├── gamification.jsx
│   │   │   └── toast.jsx                        # ToastProvider + useToast()
│   │   │
│   │   ├── styles/
│   │   │   └── index.css
│   │   │
│   │   ├── sw.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
│
├── server/                                    # ─── Express + Prisma + Socket.IO
│   │
│   ├── prisma/
│   │   ├── schema.prisma                      # Все модели
│   │   ├── migrations/                        # ─── Prisma migrations
│   │   │   ├── 0_init/                        # Baseline для существующей схемы
│   │   │   ├── <timestamp>_add_pending_deletion/
│   │   │   └── migration_lock.toml
│   │   └── seed/                              # Наполнение курсов
│   │       ├── index.js
│   │       ├── helpers.js
│   │       └── courses/
│   │           ├── photography.js
│   │           ├── videography.js
│   │           ├── editing.js
│   │           ├── radio.js
│   │           ├── studio-sound.js
│   │           └── live-sound.js
│   │
│   ├── src/
│   │   │
│   │   ├── app.js                             # Express-приложение (без listen) — для тестов
│   │   ├── index.js                           # Точка входа: HTTP + Socket.IO + cron
│   │   ├── socket.js                          # Socket.IO: чаты, typing, сообщения, реакции
│   │   │
│   │   ├── docs/
│   │   │   └── swagger.js                     # Конфиг OpenAPI 3.0.3 + общие схемы
│   │   │
│   │   ├── lib/
│   │   │   ├── prisma.js
│   │   │   ├── notify.js
│   │   │   ├── push.js
│   │   │   ├── backup.js
│   │   │   ├── dbMaintenance.js
│   │   │   ├── chatCleanup.js
│   │   │   ├── analytics.js
│   │   │   ├── bulkActions.js
│   │   │   ├── serverInfo.js
│   │   │   ├── moderation.js
│   │   │   ├── passwordReset.js
│   │   │   ├── passwordResetCron.js
│   │   │   ├── pushCleanup.js
│   │   │   ├── pushCleanupCron.js
│   │   │   ├── notifyCleanup.js
│   │   │   ├── notifyCleanupCron.js
│   │   │   ├── adminActionCleanup.js          # Автоочистка журнала AdminAction
│   │   │   ├── adminActionCleanupCron.js      # Cron-обёртка
│   │   │   ├── pendingDeletion.js             # Очередь отложенного удаления + воркер
│   │   │   ├── gamification.js
│   │   │   ├── gamificationCatalog.js
│   │   │   ├── gamificationSettings.js
│   │   │   ├── gamificationCron.js
│   │   │   ├── courseLogic.js
│   │   │   └── audioPeaks.js
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.js                        # JWT + requireRole + инвалидация по passwordChangedAt
│   │   │   └── errorHandler.js                # Глобальный обработчик: Prisma-коды → HTTP-статусы
│   │   │
│   │   └── routes/
│   │       ├── auth.js                        # + OpenAPI-аннотации
│   │       ├── users.js                       # + OpenAPI-аннотации
│   │       ├── posts.js                       # + OpenAPI-аннотации
│   │       ├── chats.js
│   │       ├── uploads.js
│   │       ├── courses.js
│   │       ├── practicals.js
│   │       ├── homework.js
│   │       ├── wiki.js
│   │       ├── notifications.js
│   │       ├── reports.js
│   │       ├── modules.js
│   │       ├── onboarding.js
│   │       ├── gamification.js
│   │       ├── publicMeta.js
│   │       │
│   │       ├── admin.js                       # Barrel: 5 строк, экспортирует admin/index.js
│   │       └── admin/                         # ─── 25 модулей админки
│   │           ├── index.js                   # Сборка + auth + requireRole('ADMIN')
│   │           ├── _shared.js                 # safe()
│   │           ├── stats.js                   # /stats
│   │           ├── system.js                  # /server/*, /maintenance/*, /maintenance/orphaned-files/*
│   │           ├── dashboard.js               # /dashboard/summary
│   │           ├── search.js                  # /search
│   │           ├── undo.js                    # /undo/:token
│   │           ├── actions.js                 # /actions, /actions/meta, /actions/cleanup-*
│   │           ├── analytics.js               # /analytics, /analytics/courses
│   │           ├── users.js                   # /users/* (включая отложенное удаление)
│   │           ├── courses.js                 # /courses/*, /lessons/*, /tests/*, /questions/*
│   │           ├── certificates.js            # /certificates/*
│   │           ├── moderation.js              # /reports/*
│   │           ├── backups.js                 # /backups/*
│   │           ├── bulk.js                    # /bulk/*
│   │           ├── wiki.js                    # /wiki/*
│   │           ├── push.js                    # /push/*
│   │           ├── notifications.js           # /notifications/cleanup-*
│   │           ├── modules.js                 # /modules
│   │           ├── onboarding.js              # /onboarding/*
│   │           ├── passwordResets.js          # /password-resets/*
│   │           ├── gamification.js            # /gamification/*
│   │           ├── practicals.js              # /mentors, /lessons/:id/practical, /practicals*
│   │           ├── homework.js                # /lessons/:id/homework, /homework*, /homeworks*
│   │           └── settings.js                # /settings, /broadcast, /groups
│   │
│   ├── tests/                                 # ─── Интеграционные тесты (Vitest + Supertest)
│   │   ├── setup.js                           # Env-check + чистка БД (CI-aware)
│   │   ├── helpers.js                         # createUser, createPost, makeAdmin, createComment
│   │   ├── smoke.test.js
│   │   ├── docs.test.js                       # Swagger UI + /api/docs.json
│   │   ├── auth.register.test.js
│   │   ├── auth.login.test.js
│   │   ├── auth.me.test.js
│   │   ├── auth.check.test.js
│   │   ├── posts.feed.test.js
│   │   ├── posts.crud.test.js
│   │   ├── posts.reactions.test.js
│   │   ├── posts.comments.test.js
│   │   ├── admin.users.test.js                # 17 тестов (включая undo)
│   │   ├── admin.moderation.test.js           # 15 тестов
│   │   ├── admin.backups.test.js              # 13 тестов
│   │   ├── admin.modules.test.js              # 8 тестов
│   │   ├── admin.maintenance.test.js          # 14 тестов
│   │   ├── admin.actions.test.js              # 14 тестов
│   │   └── admin.search.test.js               # 10 тестов
│   │
│   ├── eslint.config.js                       # ESLint (flat config, ignoreRestSiblings, 0 warnings)
│   ├── vitest.config.js                       # Vitest (forks, loadEnv .env.test)
│   ├── uploads/                               # Загруженные файлы (создаётся автоматически)
│   ├── backups/                               # Дампы PostgreSQL (создаётся автоматически)
│   ├── .env                                   # Не в git
│   ├── .env.local                             # Не в git
│   ├── .env.test                              # Не в git
│   ├── .env.example                           # Шаблон
│   ├── .env.test.example                      # Шаблон тестового окружения
│   └── package.json
│
├── .gitignore                                 # node_modules, .env, .env.local, .env.test, uploads/, backups/, dist/,
│                                              # собранный клиент в корне (index.html, assets/, sw.js, ...)
└── README.md
```

### Ключевые принципы организации

**Клиент:**
- **store/** — глобальный стейт через React Context. Каждый провайдер отвечает за свою часть. `toast.jsx` — тосты поверх всего приложения.
- **pages/Admin/** — модульная админка. Один раздел = один файл в `tabs/`, всё сложное — в подпапках.
- **components/messenger/** — вынесено отдельно, т.к. мессенджер — самая тяжёлая часть UI.
- **hooks/** — переиспользуемая логика.
- **lib/** — утилиты без React.

**Сервер:**
- **`app.js`** — «чистое» Express-приложение. Экспортирует `app`, не вызывает `listen`. Это позволяет тестам импортировать его напрямую.
- **`index.js`** — только запуск: HTTP-сервер, Socket.IO, cron + `startPendingDeletionWorker()`.
- **lib/** — вся бизнес-логика. Роуты тонкие, они только валидируют и вызывают функции из lib. Ошибки бросают через `Object.assign(new Error(msg), { status: N })` — их ловит `errorHandler`.
- **middleware/errorHandler.js** — единая точка для ошибок. Все Prisma-коды и `err.status` маппятся тут.
- **docs/swagger.js** — конфиг OpenAPI + общие схемы (`Error`, `User`, `AuthResponse`, `Post`, `PostInFeed`, `Comment`, `CommentTree`, `AggregatedReactions`). Аннотации ищутся через `apis: [...]` в `routes/**/*.js` и `app.js`.
- **routes/** — HTTP-слой. Все роуты оборачиваются в `safe(fn)` — тонкий passthrough над `next(err)`. Роуты содержат `@openapi`-блоки прямо над хендлерами.
- **routes/admin/** — модульная админка (25 файлов). `routes/admin.js` — тонкий barrel.
- **prisma/seed/** — данные курсов отделены от кода.
- **prisma/migrations/** — миграции схемы (начиная с baseline `0_init`).
- **tests/** — интеграционные тесты, ходят через Supertest прямо в `app` без запуска сервера.

### Особенности

- **Prisma migrate с baseline.** Первая миграция `0_init` помечена как применённая на проде (`prisma migrate resolve --applied 0_init`) — это значит, что существующая схема не пересоздаётся, но все будущие миграции применятся корректно.
- **`uploads/` и `backups/`** — не в git, создаются на сервере.
- **`.env` / `.env.local` / `.env.test`** — обязательны для соответствующих режимов, шаблоны в `.env.example` и `.env.test.example`.
- **Собранный клиент публикуется в корень репо** — nginx отдаёт статику именно из `/www/wwwroot/mediarafraw.ru`, а не из `client/dist`. Эти файлы (index.html, assets/, sw.js, иконки) перечислены в `.gitignore` и не коммитятся.
- **PWA-манифест** — генерируется `vite-plugin-pwa` из `vite.config.js`, в `public/` лежат только иконки.
- **Swagger генерируется на старте.** `docs/swagger.js` использует top-level await над `swaggerJsdoc(options)` (v7 возвращает Promise). В `app.js` spec подключается к роутам `/api/docs` (UI) и `/api/docs.json` (raw). При добавлении новой схемы в `components.schemas` — обновляй `swagger.js`, при добавлении роута — просто ставь `@openapi` JSDoc над хендлером.
- **Отложенное удаление.** Все деструктивные DELETE-роуты возвращают `{ ok, undoToken, executeAt, undoWindowMs }`. UI показывает тост с кнопкой «Отменить» на 20 секунд. Если не отменить — воркер через 30 секунд выполняет реальное удаление. В журнал пишутся три события: `schedule_delete_<type>`, `undo_delete_<type>`, `execute_delete_<type>`.

---

## 🗄 Работа с базой данных

Проект использует **PostgreSQL** и **Prisma ORM** с **migrate** (история миграций ведётся).

### Основные команды

```bash
cd server

# Применить все миграции к БД (прод, CI, ручной запуск)
npx prisma migrate deploy

# Создать новую миграцию после изменения schema.prisma (локально)
npx prisma migrate dev --name add_something

# Создать миграцию без применения (для случаев, когда БД нет локально)
npx prisma migrate dev --create-only --name add_something

# Пометить миграцию как применённую (для baseline)
npx prisma migrate resolve --applied 0_init

# Пересобрать Prisma Client (обязательно после изменения схемы)
npx prisma generate

# Открыть Prisma Studio
npx prisma studio

# Проверить статус миграций
npx prisma migrate status

# Проверить схему без изменений
npx prisma validate
```

> ⚠️ `prisma migrate dev` читает `server/.env` — там **прод-URL**. Для локальной работы используйте алиас `prisma-local` (см. раздел «Переменные окружения») или явный override: `DATABASE_URL="postgresql://media_raf_raw:dev_password_local@localhost:5434/media_raf_raw_dev" npx prisma migrate dev`.

### Baseline `0_init`

Первая миграция `server/prisma/migrations/0_init/migration.sql` создана через `prisma migrate diff` из текущей схемы и **помечена как уже применённая** на проде через `migrate resolve --applied`. Это значит:

- Существующая БД не пересоздаётся.
- `_prisma_migrations` содержит запись `0_init`.
- Все будущие миграции применятся штатно поверх.

**Если разворачиваете проект с нуля** (новая БД без данных) — просто запустите `npx prisma migrate deploy`. Она применит `0_init` и создаст все таблицы.

**Если БД уже существует** (например, восстановлена из дампа) — после `git clone` нужно один раз выполнить:

```bash
npx prisma migrate resolve --applied 0_init
```

### Как добавить новую миграцию

```bash
cd server

# 1. Изменить schema.prisma (добавить поле/модель/индекс)

# 2. Локально: создать миграцию + применить к dev-БД
prisma-local migrate dev --name add_user_locale

# 3. Закоммитить папку prisma/migrations/<timestamp>_add_user_locale/
git add prisma/migrations/
git commit -m "feat(db): add User.locale"
git push
```

На проде при следующем деплое `scripts/deploy.sh` вызовет `prisma migrate deploy`, которая применит новую миграцию автоматически.

### Важно

- **Никогда не редактируйте существующие миграции.** Если нашли ошибку — создайте новую миграцию, которая исправляет.
- **`prisma db push` — только для тестовой БД в ручных экспериментах.** В проде и CI используется `migrate deploy`.
- После изменения `schema.prisma` **обязательно** `npx prisma generate` и **полный перезапуск** Node-процесса:
  ```bash
  systemctl restart mediaraf-api
  ```
  `systemctl reload` не подхватит новые модели.

### Модели БД (обзор)

| Группа | Модели |
|---|---|
| Пользователи | `User`, `PushSubscription` |
| Соцсеть | `Post`, `Comment`, `PostReaction` |
| Мессенджер | `Chat`, `ChatMember`, `Message`, `Reaction` |
| Курсы | `Course`, `Lesson`, `Test`, `Question`, `TestAttempt`, `Enrollment`, `LessonProgress`, `Certificate` |
| Практики и ДЗ | `PracticalWork`, `PracticalSubmission`, `Homework`, `HomeworkSubmission` |
| Wiki | `WikiCategory`, `WikiArticle` |
| Система | `Notification`, `Setting`, `AdminAction`, `PendingDeletion` |
| Модерация | `Report` |
| Пароли | `PasswordResetRequest` |
| Геймификация | `UserStats`, `UserAchievement`, `XpLog`, `DailyQuest`, `QuestTemplate`, `Achievement` |

### Бэкапы

Дамп БД делается через `pg_dump` **от той же версии, что и сервер БД**. Если PostgreSQL на сервере 18-й, а системный `pg_dump` — 16-й, будет ошибка `server version mismatch`. Поэтому `scripts/deploy.sh` автоматически ищет подходящий `pg_dump`:

1. `/www/server/pgsql/bin/pg_dump` (aaPanel, PostgreSQL 18).
2. `/usr/lib/postgresql/18/bin/pg_dump`.
3. `/usr/local/pgsql/bin/pg_dump`.
4. Системный `pg_dump`.

Если ни один не подходит — берётся первый доступный.

---

## 🧪 Тестирование

Проект покрыт **интеграционными тестами** на бэкенде. Тесты ходят через `supertest` прямо в Express-приложение (`src/app.js`), без запуска HTTP-сервера и Socket.IO — поэтому прогон быстрый и без побочных эффектов.

**Всего: 173 теста в 16 файлах**, прогон ~60–70 секунд.

### Что тестируется

| Файл | Покрытие |
|---|---|
| `tests/smoke.test.js` | Проверка, что ключевые модули экспортируют функции |
| `tests/docs.test.js` | Swagger UI (`/api/docs`) и OpenAPI spec (`/api/docs.json`) |
| `tests/auth.register.test.js` | Регистрация: успех, валидация, уникальность, нормализация телефона/username |
| `tests/auth.login.test.js` | Вход: по username / телефону / email, регистронезависимость, бан |
| `tests/auth.me.test.js` | Текущий пользователь: токен, бан, обновление `lastSeen` |
| `tests/auth.check.test.js` | Проверка занятости username/телефона |
| `tests/posts.feed.test.js` | Лента: пагинация (cursor-based, без потерь), порядок, фильтрация забаненных, реакции |
| `tests/posts.crud.test.js` | Создание/редактирование/удаление постов + права доступа |
| `tests/posts.reactions.test.js` | Реакции: toggle, разные эмодзи, агрегация |
| `tests/posts.comments.test.js` | Комментарии: вложенность, редактирование, удаление, права |
| `tests/admin.users.test.js` | Пользователи: роли, бан, пароль, отложенное удаление, undo, аудит |
| `tests/admin.moderation.test.js` | Жалобы: список, фильтры, статусы, delete-content, ban-user |
| `tests/admin.backups.test.js` | Бэкапы: права, валидация имён, path traversal, restore без filename |
| `tests/admin.modules.test.js` | Включение/выключение модулей, «хотя бы один включён» |
| `tests/admin.maintenance.test.js` | Обслуживание БД: скан, детализация, path traversal, whitelist расширений, 409-гонка, аудит |
| `tests/admin.actions.test.js` | История действий: фильтры, пагинация, cleanup-settings, dry-run, реальная очистка |
| `tests/admin.search.test.js` | Глобальный поиск: users, courses, posts, certificates, wiki, лимиты, короткий запрос |

### Подготовка тестовой БД

**Вариант А — Docker (рекомендуется):**

```bash
# 1. Из корня репо
docker compose -f docker-compose.dev.yml up -d

# 2. Скопировать шаблон env
cd server
cp .env.test.example .env.test

# 3. Применить миграции к тестовой БД
prisma-local migrate deploy
```

**Вариант Б — системный Postgres:**

```bash
sudo -u postgres psql -c "CREATE DATABASE media_raf_raw_test;"
cd server
DATABASE_URL="postgresql://media_raf_raw:пароль@localhost:5432/media_raf_raw_test" npx prisma migrate deploy
```

### Запуск

```bash
cd server

# Все тесты
npm test

# Один файл
npx vitest run tests/admin.users.test.js

# Watch-режим
npm run test:watch

# С покрытием
npm run test:cov
```

**Ожидаемый результат:** `Test Files 16 passed (16)` / `Tests 173 passed (173)`.

### Как устроены тесты

- **`tests/setup.js`** — `beforeAll` проверяет `DATABASE_URL` (и, если не CI, что порт не 5432 — защита от запуска против прод-БД). `afterEach` удаляет всех тестовых юзеров (по префиксу `+7999` и `test_`) и связанные данные. Даёт 250 мс «хвоста» для завершения fire-and-forget задач (геймификация, уведомления), чтобы не ловить `P2025`.
- **`tests/helpers.js`** — утилиты: `createUser`, `createPost`, `createComment`, `makeAdmin`, `validPayload`. Генерируют уникальные телефоны и username, чтобы тесты не конфликтовали.
- **Изоляция от прод-данных.** Тесты постов фильтруют ленту по автору (`onlyTestPosts`), чтобы не полагаться на пустую БД.
- **Уникальные маркеры.** Тесты поиска используют `Date.now()` в строках, чтобы не пересекаться с другими тестами.
- **ENV для тестов читается из `.env.test`**, а не `.env`. Это делает `vitest.config.js` через `loadEnv({ path: '.env.test', override: true })`.
- **CI-aware sanity-check.** Если `process.env.CI === 'true'`, проверка порта (5432 vs 5434) пропускается — в GitHub Actions Postgres поднимается как service именно на 5432.

### Пойманные баги (история)

- `posts.feed.test.js` при первом запуске поймал реальный баг в cursor-пагинации: последний элемент страницы «съедался» и терялся на следующей странице. Исправлено.
- `admin.moderation.test.js` поймал 3 проблемы в `lib/moderation.js`: голые `Error` без `status` (500 вместо 400/404) и `banReportedUser` не помечал жалобу `RESOLVED`. Исправлено.
- `admin.backups.test.js` (в связке с ручным аудитом) вскрыл **path traversal** в `DELETE /admin/backups/:filename` — исправлено через `path.basename` + проверку расширения.

### Что делать, если тесты упали

1. Проверь `DATABASE_URL` — точно указывает на тестовую БД (порт 5434 для Docker)?
2. Убедись, что Postgres-контейнер поднят: `docker ps | grep postgres-dev`.
3. Если падает с `Environment variable not found` — проверь, что `.env.test` существует и в нём есть `DATABASE_URL`.
4. Если падает с `Cannot read properties of undefined` на `prisma.<модель>` — забудь про `npx prisma generate` после изменения схемы.
5. Смотри в лог — Vitest показывает конкретный assert и стек.

---

## 📖 Swagger / OpenAPI

Проект использует **Swagger UI** для интерактивной документации и **OpenAPI 3.0.3** для машиночитаемого описания API.

### Где смотреть

- **UI (интерактив):** http://localhost:4000/api/docs (в проде — `https://mediarafraw.ru/api/docs`)
- **Raw spec:** http://localhost:4000/api/docs.json

UI даёт:
- список всех эндпоинтов, сгруппированных по тегам (`System`, `Auth`, `Users`, `Posts`);
- интерактивный режим **«Try it out»** — можно выполнить запрос из браузера;
- кнопку **Authorize** — вставь JWT, и он подхватится во все защищённые запросы (сохраняется в `localStorage` браузера, не сбрасывается при F5);
- `displayRequestDuration` — время выполнения каждого запроса.

Raw spec можно импортировать в Postman, Insomnia, использовать для генерации клиентов (`openapi-generator`, `orval`).

### Как устроено

Файлы:

- **`server/src/docs/swagger.js`** — конфиг OpenAPI 3.0.3. Здесь описаны: `info`, `servers`, `tags`, `components.securitySchemes.bearerAuth`, общие `components.schemas` (`Error`, `User`, `AuthResponse`, `Post`, `PostInFeed`, `Comment`, `CommentTree`, `AggregatedReactions`). В блоке `apis` указано, где искать `@openapi`-аннотации: `routes/**/*.js` + `app.js`. Использует `swagger-jsdoc@7.0.0-rc.6` через top-level await (v7 возвращает Promise).
- **`server/src/app.js`** — подключает роуты `/api/docs` (UI) и `/api/docs.json` (raw). **Важно:** регистрируются **до** 404-хендлера `/api/*` и SPA fallback, иначе перехватятся.
- **`server/src/routes/auth.js`, `users.js`, `posts.js`** — содержат JSDoc-блоки с тегом `@openapi` прямо над соответствующими роутами.

### Как добавить документацию для нового эндпоинта

Просто поставь JSDoc-блок с `@openapi` над хендлером:

```js
/**
 * @openapi
 * /my-new-endpoint:
 *   get:
 *     tags: [MyTag]
 *     summary: Краткое описание
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Успех
 */
router.get('/my-new-endpoint', auth, async (req, res) => { ... });
```

Spec подхватит блок **при следующем запуске** сервера (перезапусти `npm run dev` или `systemctl restart mediaraf-api`).

### Покрытие (текущее состояние)

| Тег | Эндпоинтов | Файл с аннотациями |
|-----|-----------|---------------------|
| `System` | 1 (`GET /health`) | `src/app.js` |
| `Auth` | 6 (register, login, me, check-username, check-phone, recover/*) | `src/routes/auth.js` |
| `Users` | 5 (`GET /`, `GET /:username`, `PATCH /me`, `PATCH /me/password`, `POST /me/posts`) | `src/routes/users.js` |
| `Posts` | 10 (feed, create, patch, delete, reactions ×2, comments ×4) | `src/routes/posts.js` |

**Не покрыто пока:** `chats.js`, `uploads.js`, `courses.js`, `practicals.js`, `homework.js`, `wiki.js`, `notifications.js`, `reports.js`, `modules.js`, `onboarding.js`, `gamification.js`, `publicMeta.js`, вся папка `admin/` (25 модулей).

Покрытие наращивается постепенно — каждое новое покрытие тестируется `tests/docs.test.js`.

---

## 🔄 CI/CD

### CI — `.github/workflows/ci.yml`

Запускается на каждый `push` в `main`/`dev` и на каждый Pull Request.

**Job `server`:**
1. Поднимает сервис-контейнер `postgres:16` (на порту 5432, стандартном для Actions).
2. Node 22.
3. `npm ci` в `server/`.
4. `npm run lint` — ESLint (0 errors, 0 warnings).
5. `npx prisma generate`.
6. `npx prisma migrate deploy` — применяет все миграции к тестовой БД.
7. `npm test` — все 173 теста.

**Job `client`:**
1. Node 22.
2. `npm ci` в `client/`.
3. `npm run build` — проверка, что фронт собирается.

**Если CI красный — PR блокируется.** Нельзя мержить код, который ломает тесты или сборку.

### CD — `.github/workflows/deploy.yml`

**Работает через self-hosted GitHub Actions runner**, установленный на самом сервере. Раннер подключается к GitHub по исходящему HTTPS — никаких открытых портов и SSH-туннелей не нужно.

**Триггеры:**
- `push` в `main` — автоматический деплой.
- `workflow_dispatch` — ручной запуск из вкладки Actions.

**Что делает workflow:**
```yaml
steps:
  - name: Run deploy script
    run: bash /www/wwwroot/mediarafraw.ru/scripts/deploy.sh
    working-directory: /www/wwwroot/mediarafraw.ru
```

То есть workflow просто запускает `scripts/deploy.sh` локально на сервере.

**Защита от параллельных деплоев:**
```yaml
concurrency:
  group: deploy-production
  cancel-in-progress: false
```

**Защита от PR-из-форков:** в Settings → Actions → General установлено «Require approval for first-time contributors». Дополнительно workflow не имеет триггера `pull_request` — только `push` и `workflow_dispatch`. Это значит, что PR из форков не может запустить деплой.

### Self-hosted runner

Установлен в `/opt/actions-runner` на сервере, работает как systemd-сервис:

```bash
systemctl status actions.runner.yurikov2126-pixel-media-raf-raw1.ubuntu.service
```

**Переменная `RUNNER_ALLOW_RUNASROOT=1`** прописана в unit-файле сервиса, потому что деплой требует root (systemctl, chown www, запись в `/root/db-backups`).

**Управление:**
```bash
cd /opt/actions-runner
./svc.sh status      # статус
./svc.sh stop        # остановить
./svc.sh start       # запустить
./svc.sh uninstall   # удалить сервис
```

**Логи:**
```bash
journalctl -u actions.runner.yurikov2126-pixel-media-raf-raw1.ubuntu.service -n 50 --no-pager
```

### Локальная проверка перед push

```bash
# Server
cd server
npm run lint       # 0 errors, 0 warnings
npm test           # 173 passed

# Client
cd ../client
npm run build      # сборка без ошибок
```

---

## 🌱 Seed курсов

Seed-скрипт удаляет все существующие курсы и создаёт заново с уроками, тестами, практиками и ДЗ.

```bash
cd server
node prisma/seed/index.js
```

### Внимание

- **Все курсы и связанные данные удаляются** (уроки, тесты, прогресс, сертификаты, практики, ДЗ).
- **Пользователи, посты, чаты и остальное сохраняются.**
- Для каждого курса создаётся своя структура: уроки, тесты (10–12 вопросов), практики с руководителем, ДЗ.

### Добавление нового курса

1. Создайте файл `server/prisma/seed/courses/название.js`:

```js
export const myCourse = {
    slug: 'moy-kurs',
    title: 'Мой курс',
    description: '...',
    category: 'photo',
    level: 'beginner',
    published: true,
    lessons: [
        {
            title: 'Урок 1',
            content: '...',
            order: 1,
            duration: 25,
            videoUrl: 'https://www.youtube.com/watch?v=XXXXX',
            test: {
                title: 'Тест к уроку',
                passScore: 70,
                questions: [
                    { type: 'single', text: '...', payload: { options: ['A', 'B'], correct: 0 } },
                ],
            },
            practical: {
                topic: 'Тема практики',
                description: 'Что делать',
                durationMin: 90,
            },
            homework: {
                title: 'Название ДЗ',
                description: 'Описание',
                maxFiles: 3,
            },
        },
    ],
};
```

2. Импортируйте его в `server/prisma/seed/index.js` и добавьте в массив `COURSES`.

---

## 🔌 API

Базовый URL: `VITE_API` (по умолчанию `http://localhost:4000/api`).

**Интерактивная документация:** `/api/docs` (Swagger UI) — там всегда актуальная версия. Ниже — краткий справочник.

Все защищённые запросы требуют заголовок:
```
Authorization: Bearer <JWT>
```

### Основные роуты

| Роут | Описание |
|---|---|
| `GET /health` | Health-check (`{ok, service}`) |
| `GET /docs` | Swagger UI (HTML) |
| `GET /docs.json` | OpenAPI 3.0.3 spec (JSON) |
| `POST /auth/register` | Регистрация |
| `POST /auth/login` | Вход |
| `GET /auth/me` | Текущий пользователь |
| `GET /auth/check-username` | Проверка занятости ника |
| `GET /auth/check-phone` | Проверка занятости телефона |
| `POST /auth/recover/request` | Запрос восстановления пароля |
| `POST /auth/recover/verify` | Смена пароля по коду |
| `GET /users` | Список пользователей |
| `GET /users/:username` | Профиль |
| `PATCH /users/me` | Обновить профиль |
| `PATCH /users/me/password` | Смена своего пароля |
| `GET /posts/feed` | Лента с cursor-пагинацией |
| `POST /posts` | Создать пост |
| `PATCH /posts/:id` | Редактировать пост (автор/ADMIN) |
| `DELETE /posts/:id` | Удалить пост (автор/ADMIN) |
| `GET /posts/:id/reactions` | Реакции на пост |
| `POST /posts/:id/reactions` | Поставить/снять реакцию (toggle) |
| `GET /posts/:id/comments` | Дерево комментариев |
| `POST /posts/:id/comments` | Добавить комментарий |
| `PATCH /posts/comments/:id` | Редактировать комментарий |
| `DELETE /posts/comments/:id` | Удалить комментарий |
| `GET /chats` | Список чатов |
| `POST /uploads` | Загрузить файл |
| `GET /courses` | Список курсов |
| `GET /courses/:slug` | Курс с уроками |
| `POST /courses/:id/enroll` | Записаться на курс |
| `POST /courses/lessons/:lessonId/complete` | Отметить урок пройденным |
| `POST /courses/tests/:testId/submit` | Отправить тест |
| `POST /practicals/:practicalId/submit` | Сдать практику |
| `POST /practicals/submissions/:id/review` | Проверить практику (MENTOR/ADMIN) |
| `POST /homework/:homeworkId/submit` | Сдать ДЗ |
| `POST /homework/submissions/:id/review` | Проверить ДЗ (MENTOR/ADMIN) |
| `GET /wiki/categories` | Wiki: категории |
| `GET /wiki/articles` | Wiki: статьи |
| `GET /notifications` | Уведомления |
| `POST /reports` | Жалоба |
| `GET /modules` | Состояние модулей |
| `GET /gamification/me` | Статистика геймификации |
| `GET /gamification/quests` | Квесты на сегодня |
| `GET /gamification/leaderboard` | Лидерборд |
| `GET /settings/public` | Публичные настройки сайта |

### Ключевые админские роуты

| Роут | Описание |
|---|---|
| `GET /admin/stats` | Счётчики для Dashboard (users, chats, messages, courses…) |
| `GET /admin/dashboard/summary` | Сводка для Dashboard-2.0: sparklines, recent activity, alerts |
| `GET /admin/server/info` | Метрики сервера (CPU, RAM, диск, БД) |
| `POST /admin/server/cleanup` | Очистка логов PM2 / старых бэкапов |
| `GET /admin/maintenance/scan` | Скан БД + детализация осиротевших файлов |
| `POST /admin/maintenance/cleanup` | Полная очистка неконсистентных данных |
| `DELETE /admin/maintenance/orphaned-files/:filename` | Удалить один осиротевший файл |
| `POST /admin/maintenance/orphaned-files/purge` | Батч-удаление (filenames / olderThanDays) |
| `GET /admin/actions` | История действий админов (фильтры: action, adminId, from, to, failed) |
| `GET /admin/actions/meta` | Уникальные actions + admins для фильтров |
| `GET /admin/actions/cleanup-settings` | Настройки автоочистки журнала |
| `POST /admin/actions/cleanup-now` | Запуск очистки (dryRun / реальный) |
| `GET /admin/search?q=…` | Глобальный поиск по users/courses/posts/certs/wiki |
| `POST /admin/undo/:token` | Отмена отложенного удаления |
| `GET /admin/users` | Список пользователей |
| `PATCH /admin/users/:id` | Обновить (role, isBanned, direction) |
| `PATCH /admin/users/:id/password` | Сменить пароль пользователя |
| `DELETE /admin/users/:id` | Отложенное удаление — возвращает `{ undoToken, executeAt, undoWindowMs }` |
| `GET /admin/reports` | Жалобы (фильтры: status, targetType) |
| `PATCH /admin/reports/:id` | Смена статуса/резолюции |
| `POST /admin/reports/:id/delete-content` | Удалить контент из жалобы |
| `POST /admin/reports/:id/ban-user` | Забанить автора |
| `DELETE /admin/reports/:id` | Удалить жалобу |
| `GET /admin/backups` | Список бэкапов |
| `POST /admin/backups` | Создать бэкап |
| `POST /admin/backups/:filename/restore` | Восстановить из бэкапа |
| `DELETE /admin/backups/:filename` | Удалить бэкап (path traversal защищён) |
| `GET /admin/gamification/*` | Настройки, достижения, квесты, уровни |
| `POST /admin/push/send` | Массовая push-рассылка |
| `GET /admin/push/cleanup-settings` | Настройки автоочистки подписок |
| `GET /admin/broadcast` | Массовая рассылка уведомлений в приложении |
| `GET /admin/modules` | Состояние модулей |
| `PUT /admin/settings` | Обновление настроек сайта |
| `... | Всего 25 модулей, см. `server/src/routes/admin/` |

### Socket.IO события

**Клиент → сервер:**
- `chat:join`, `message:send`, `message:edit`, `message:delete`, `reaction:toggle`, `typing`

**Сервер → клиент:**
- `message:new`, `message:edited`, `message:deleted`, `reaction:update`, `typing`, `user:online`, `user:offline`, `notification:new`, `chat:updated`

---

## 📱 PWA и офлайн-режим

### Что кешируется

- **HTML/JS/CSS** — precache через `vite-plugin-pwa` (injectManifest).
- **`/uploads/`** — стратегия `CacheFirst`, TTL 30 дней, до 200 записей.
- **`/api/`** — `NetworkOnly`.

### Офлайн-поведение

- Splash-экран с логотипом.
- Если сессия сохранена, а сети нет — **Offline-экран** с кнопкой «Повторить».
- Если приложение открыто и сеть пропала — **баннер** сверху.

### Установка

На мобильном открыть сайт → «Поделиться» → **«Добавить на главный экран»**.

### Обновление

Service Worker обновляется автоматически (`registerType: 'autoUpdate'`).

---

## ⏰ Cron-задачи

Все cron-задачи регистрируются в `server/src/index.js`.

| Задача | Расписание | Что делает |
|---|---|---|
| Push cleanup | `0 4 * * *` | Удаляет неактивные push-подписки |
| Notify cleanup | `30 4 * * *` | Удаляет старые прочитанные уведомления |
| Password reset cleanup | `45 4 * * *` | Удаляет старые заявки на восстановление пароля |
| Gamification inactivity | `0 5 * * *` | Списывает XP у неактивных пользователей |
| Action cleanup | `0 6 * * *` | Удаляет старые записи журнала `AdminAction` |
| Deadline reminders | `0 9 * * *` | Напоминания о дедлайнах практик/ДЗ |
| Drip unlock notifications | `0 8 * * *` | Уведомления о разблокировке уроков |
| Pending deletion worker | каждые 30 сек | Выполняет отложенные удаления после истечения окна отмены |

Расписание переопределяется через переменные окружения (`PUSH_CLEANUP_CRON`, `NOTIFY_CLEANUP_CRON`, `PASSWORD_RESET_CLEANUP_CRON`, `GAMIFICATION_INACTIVITY_CRON`, `ACTION_CLEANUP_CRON`).

---

## 🚢 Деплой

### Автоматический деплой (основной способ)

```bash
# На Mac
cd ~/WebstormProjects/media-raf-raw1
git push origin main
```

Всё. Через ~1 минуту прод обновлён.

**Как это работает:**
1. `git push` → GitHub получает коммит.
2. GitHub отправляет задачу self-hosted runner'у на сервере.
3. Раннер выполняет `bash /www/wwwroot/mediarafraw.ru/scripts/deploy.sh`.
4. Скрипт делает полный деплой (см. ниже).
5. Через ~60 секунд — зелёная галочка в GitHub Actions, прод обновлён.

**Где смотреть:**
- GitHub Actions: https://github.com/yurikov2126-pixel/media-raf-raw1/actions
- Лог деплоя на сервере: `tail -f /var/log/mediaraf-deploy.log`

### Ручной деплой

Если нужно задеплоить без пуша (например, после `git pull` вручную):

```bash
cd /www/wwwroot/mediarafraw.ru
bash scripts/deploy.sh
```

### Что делает `scripts/deploy.sh`

1. **Проверка состояния репо.** Если есть незакоммиченные трекаемые файлы — стоп (untracked не считаются: там собранный клиент и служебные файлы).
2. **Бэкап БД.** Автоматически ищет `pg_dump` подходящей версии. Сохраняет в `/root/db-backups/mediaraf_YYYYMMDD_HHMMSS.sql`.
3. **`git pull origin main`.** Настроено `git config pull.ff only`.
4. **Server:** `npm ci`, `npx prisma generate`, `npx prisma migrate deploy`.
5. **Restart API:** `systemctl restart mediaraf-api`, проверка `is-active` + `curl /api/health`.
6. **Client:** `npm ci`, `npm run build`.
7. **Публикация клиента.** `cp -r client/dist/. .` + `chown -R www:www`.
8. **Финальные проверки:** API, `localhost/`, внешний домен.

**Перед каждым `npm ci`** скрипт выставляет `npm config set registry https://registry.npmjs.org/`.

Лог пишется в `/var/log/mediaraf-deploy.log`.

### Откат

**Если деплой сломал прод:**

```bash
# На сервере
cd /www/wwwroot/mediarafraw.ru

# 1. Откатить код
git reset --hard <предыдущий_коммит>
cd server && npm ci && npx prisma generate && npx prisma migrate deploy
systemctl restart mediaraf-api
cd ../client && npm ci && npm run build
cp -r client/dist/. .

# 2. Если БД испорчена — восстановить из бэкапа
ls -la /root/db-backups/    # найти последний дамп
psql "$DATABASE_URL" < /root/db-backups/mediaraf_YYYYMMDD_HHMMSS.sql
```

### Первичная настройка сервера (aaPanel / Ubuntu)

```bash
# 1. Установить Node.js ≥ 22, PostgreSQL, ffmpeg
sudo apt update
sudo apt install -y postgresql ffmpeg

# 2. Первичная настройка
cd /www/wwwroot/mediarafraw.ru

# Клиент
cd client && npm config set registry https://registry.npmjs.org/ && npm install && npm run build

# Сервер
cd ../server && npm config set registry https://registry.npmjs.org/ && npm install
npx prisma generate
npx prisma migrate deploy

# 3. systemd-юнит
cat > /etc/systemd/system/mediaraf-api.service <<'EOF'
[Unit]
Description=MEDIA-RAF-RAW API (Express + Socket.IO)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=www
Group=www
WorkingDirectory=/www/wwwroot/mediarafraw.ru/server
EnvironmentFile=/www/wwwroot/mediarafraw.ru/server/.env
ExecStart=/www/server/nodejs/v24.21.0/bin/node src/index.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/mediaraf-api.log
StandardError=append:/var/log/mediaraf-api.err.log

[Install]
WantedBy=multi-user.target
EOF

# Путь к node может отличаться — проверьте `which node`.
touch /var/log/mediaraf-api.log /var/log/mediaraf-api.err.log
chown www:www /var/log/mediaraf-api.log /var/log/mediaraf-api.err.log
systemctl daemon-reload
systemctl enable mediaraf-api
systemctl start mediaraf-api

# 4. Self-hosted runner для CD
mkdir -p /opt/actions-runner && cd /opt/actions-runner
curl -o actions-runner-linux-x64-2.337.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.337.0/actions-runner-linux-x64-2.337.0.tar.gz
tar xzf actions-runner-linux-x64-2.337.0.tar.gz

export RUNNER_ALLOW_RUNASROOT=1
./config.sh --url https://github.com/yurikov2126-pixel/media-raf-raw1 --token <TOKEN>
./svc.sh install root

# Добавить Environment=RUNNER_ALLOW_RUNASROOT=1 в unit-файл сервиса
systemctl edit --full actions.runner.yurikov2126-pixel-media-raf-raw1.ubuntu.service
systemctl daemon-reload
./svc.sh start
```

### Управление API

```bash
systemctl status mediaraf-api    # статус
systemctl restart mediaraf-api   # перезапуск
systemctl stop mediaraf-api      # остановка
systemctl start mediaraf-api     # запуск
journalctl -u mediaraf-api -n 50 # логи через journald
tail -f /var/log/mediaraf-api.log # логи приложения
```

### Управление runner'ом

```bash
cd /opt/actions-runner
./svc.sh status
./svc.sh stop
./svc.sh start
journalctl -u actions.runner.yurikov2126-pixel-media-raf-raw1.ubuntu.service -n 50 --no-pager
```

### Nginx

**Важно:** nginx раздаёт статику **из корня репозитория** (`/www/wwwroot/mediarafraw.ru`), а не из `client/dist`. `scripts/deploy.sh` копирует собранный клиент в корень после каждой сборки.

```nginx
server {
    listen 443 ssl http2;
    server_name mediarafraw.ru;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    root /www/wwwroot/mediarafraw.ru;
    index index.html;

    # OG-теги для ботов
    location ~ ^/(app/u/|app/certificates/|verify/|app/wiki/|app/courses/) {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Загруженные файлы
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 👥 Роли пользователей

| Роль | Возможности |
|---|---|
| **STUDENT** | Обычный доступ: лента, чаты, курсы, wiki, геймификация |
| **MENTOR** | + проверка практик и ДЗ у своих студентов |
| **ADMIN** | Полный доступ: админ-панель, модерация, все настройки, принудительная разблокировка уроков |

---

## 📜 Скрипты

### В корне репозитория

```bash
scripts/deploy.sh              # Деплой на прод (вызывается и вручную, и из GitHub Actions)
```

### Server (`server/package.json`)

```json
{
  "scripts": {
    "dev": "node --watch --env-file=.env.local src/index.js",
    "start": "node src/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage",
    "lint": "eslint src tests --ext .js",
    "lint:fix": "eslint src tests --ext .js --fix",
    "format": "prettier --write \"src/**/*.js\"",
    "db:migrate": "prisma migrate deploy",
    "db:migrate:dev": "prisma migrate dev",
    "db:seed": "node prisma/seed/index.js",
    "db:generate": "prisma generate"
  }
}
```

### Client (`client/package.json`)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "icons": "node scripts/generate-icons.mjs"
  }
}
```

---

## 🔐 Безопасность

- **JWT в `localStorage`** — уязвимо к XSS. Убедитесь, что весь пользовательский контент санитайзится.
- **`passwordChangedAt`** инвалидирует все старые токены при смене пароля.
- **Rate limit** на восстановление пароля (5 запросов / сутки).
- **Уникальные индексы** в БД на `username`, `phone`, `email`.
- **CORS** — настраивается на конкретный домен, а не `origin: true`.
- **Загружаемые файлы** — лимит 200 МБ, изображения сжимаются через `sharp` до 1920px.
- **Path traversal защищён в `/admin/backups/*`.** `DELETE`, `GET /download` и `POST /restore` используют `path.basename` + проверку расширения (`.dump`/`.sql`) + `startsWith(BACKUPS_DIR)`. **Не удаляй эти проверки при рефакторинге.**
- **Path traversal защищён в `/admin/maintenance/orphaned-files/:filename`.** `safeUnlinkOrphan` делает `path.basename` + whitelist расширений + `path.resolve` + `startsWith(UPLOADS_DIR)`. Дополнительно 409 если файл за это время «привязался» к посту/сообщению.
- **Харденинг геймификации** — все операции `awardXp`/`deductXp` устойчивы к удалению пользователя во время выполнения (`P2025`/`P2003` не падают, а тихо возвращают `null`).
- **Харденинг модерации** — `lib/moderation.js` бросает ошибки через `Object.assign(new Error(msg), { status })`, чтобы глобальный `errorHandler` возвращал 400/404 вместо 500 на ожидаемых ситуациях.
- **Swagger UI (`/api/docs`) открыт без авторизации.** Это норма для внутреннего проекта, но если планируется более чувствительный API — стоит решить одно из трёх: (а) оставить как есть, (б) закрыть в проде через `if (process.env.NODE_ENV !== 'production')`, (в) обернуть в `auth + requireRole('ADMIN')`. Пока открыт осознанно.
- **Self-hosted runner — только для `push` в main.** Workflow деплоя не имеет триггера `pull_request`. В Settings → Actions включено «Require approval for first-time contributors». Это защищает от запуска деплоя из PR-из-форков.
- **PostgreSQL слушает только `127.0.0.1:5432`** — снаружи недоступен.
- **`.env`, `.env.local`, `.env.test` — не в git.** Если случайно закоммитили — немедленно:
    1. Удалите файл: `git rm --cached server/.env`.
    2. Добавьте в `.gitignore`.
    3. **Ротируйте все секреты**, которые в нём были (`JWT_SECRET`, `VAPID_*`, пароль БД). Просто удалить файл недостаточно — он остаётся в истории git.
    4. После ротации `JWT_SECRET` все активные сессии станут невалидными — пользователи перелогинятся.

---

## 🗺 Дорожная карта: улучшение админ-панели

Админка функциональна и уже прошла серию улучшений. Ниже — что сделано и что осталось.

### ✅ Что сделано

| # | Задача | Что дало |
|---|---|---|
| 1 | **Lazy loading вкладок + скелетоны** | –30–40% бандла, старт быстрее |
| 2 | **Toast-система вместо `alert()`** | Убрано ~40 блокирующих диалогов, тосты с action-кнопкой «Отменить» |
| 3 | **Sidebar + mobile drawer** | 18 разделов сгруппированы в 6 смысловых блоков, на мобильном — overlay-drawer |
| 4 | **URL-фильтры** в Moderation, Users, Actions | Ссылка на отфильтрованный список shareable, «Назад» работает ожидаемо |
| 5 | **Undo-удаление** (30 сек) | Защита от случайных кликов + три события в журнале аудита (`schedule`/`undo`/`execute`) |
| 6 | **Command palette ⌘K** | Быстрый переход по разделам, поиск по users/courses/posts/certs/wiki через сервер с debounce 300 мс |
| 7 | **Дашборд-2.0** | Sparklines за 7/30 дней, quick actions, recent activity, alerts по здоровью сервера |
| 8 | **Global search** | `GET /admin/search?q=...` с параллельным поиском по 5 типам сущностей |
| 9 | **Детализация осиротевших файлов** | Раскрывающийся список с превью, размерами, датами, per-file delete + batch purge |
| 10 | **Вкладка «История действий»** | Фильтры (action/adminId/from/to/failed), пагинация, раскрывающийся payload, автоочистка |
| 11 | **Автоочистка `AdminAction`** | Cron раз в сутки в 06:00, минимум 7 дней, dry-run |
| 12 | **Массовые операции в Users** | Выделение чекбоксами, роль/бан/разбан/удаление одним кликом |

### ⏳ Что осталось (бэклог)

| # | Задача | Влияние | Усилия |
|---|---|---|---|
| 1 | **Undo для Post / Comment / Wiki** | Среднее | ~1 час (инфраструктура готова) |
| 2 | **Real-time обновления** через Socket.IO | Высокое | 1 день |
| 3 | **Notification center для админа** | Среднее | 1 день |
| 4 | **Единый `FiltersBar`** | Среднее | полдня |
| 5 | **Virtual scrolling** в Users и Actions | Среднее | 1 день |
| 6 | **Хлебные крошки** | Низкое | 2 часа |
| 7 | **Экспорт журнала в CSV/JSON** | Низкое | 3 часа |

### 🔧 Технический долг (не срочно)

- **Рефакторинг 21 места записи в `AdminAction`** на единый `lib/adminLog.js`. Сейчас каждый роут пишет инлайн.
- **`npm ci` вместо `npm install`** в CI-job `server` — улучшит воспроизводимость.
- **Кэш `collectUsedFiles()`** на 60 секунд — если на проде `/uploads/` станет большим.
- **Детализация остальных категорий в `MaintenanceBlock`** — сейчас раскрыт только `orphanFiles`; можно так же сделать для чатов, дублей, битых ссылок.
- **Swagger для admin-роутов** — покрытие `/admin/*` пока нулевое (25 модулей).

---

## 🐛 Известные ограничения

- **SQLite не поддерживается** — только PostgreSQL. Для dev на Mac используйте `docker compose -f docker-compose.dev.yml up -d`.
- **ffmpeg** обязателен для генерации waveform голосовых. Без него используется fallback.
- **`pg_dump` и PostgreSQL должны совпадать по мажорной версии.** На проде PostgreSQL 18, а системный `pg_dump` в Ubuntu 24.04 — 16. `scripts/deploy.sh` автоматически ищет `pg_dump` от 18-й версии (aaPanel-овский `/www/server/pgsql/bin/pg_dump`).
- **npm-зеркала.** aaPanel ставит глобально `registry.npmmirror.com`, где периодически нет свежих пакетов. `scripts/deploy.sh` принудительно переключает registry на `https://registry.npmjs.org/`.
- **`swagger-jsdoc@7.0.0-rc.6`** — это RC-версия, стабильной v7 пока нет. Она использует top-level await (ESM) и не требует `.cjs`-обёртки. Если RC-версия сломается — план Б: откатиться на `swagger-jsdoc@6.3.0` через `.cjs`-конфиг с `createRequire`.
- **VAPID-ключи** были в истории git (в `.env.test`). Формально скомпрометированы. Для полной чистоты нужна ротация (сломает существующие push-подписки — все пользователи должны подписаться заново). Пока отложено.
- **PDF-экспорт сертификатов** работает на клиенте через `html-to-image` + `jsPDF`.
- **Порты Docker vs прод.** Локально Postgres — на 5434 (чтобы не конфликтовать с системным). В CI — на 5432 (стандартный для GitHub Actions). Sanity-check в `tests/setup.js` учитывает это через `if (!process.env.CI)`.
- **`prisma migrate dev` и прод-URL.** Prisma читает `server/.env`, где локально прописан прод-URL. Для локальных команд используйте алиас `prisma-local` (см. «Переменные окружения»), иначе получите `P1001: Can't reach database server at localhost:5432`.
- **Покрытие Swagger неполное.** Задокументированы только `System`, `Auth`, `Users`, `Posts`. Остальные роуты (`chats`, `courses`, `admin/*` и т.д.) — по мере надобности.
- **`PendingDeletion` растёт только на время окна отмены.** Каждая запись живёт 30 секунд, потом удаляется воркером. Отдельный cleanup не нужен.

---

## 📄 Лицензия

Проект разработан для внутреннего использования студенческим медиацентром **MEDIA·RAF·RAW** (Radio Политех-FM). Не предназначен для публичного распространения без согласования с автором.

---

## 🙏 Благодарности

- Команда медиацентра MEDIA·RAF·RAW за тестирование и фидбэк.
- Сообщество разработчиков за открытые библиотеки, на которых построен проект.

---

**Made with ❤️ by MEDIA·RAF·RAW team**