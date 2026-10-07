# MEDIA·RAF·RAW

> Платформа студенческого медиацентра · Radio Политех-FM

Внутренняя платформа для команды студенческого медиацентра: лента публикаций, мессенджер, образовательные курсы с практиками и домашними заданиями, база знаний, система сертификатов, геймификация и модерация. Работает как SPA + PWA с офлайн-режимом.

---

## 📑 Оглавление

- [Возможности](#-возможности)
- [Стек технологий](#-стек-технологий)
- [Архитектура](#-архитектура)
- [Быстрый старт](#-быстрый-старт)
- [Переменные окружения](#-переменные-окружения)
- [Структура проекта](#-структура-проекта)
- [Работа с базой данных](#-работа-с-базой-данных)
- [Тестирование](#-тестирование)
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
- **Админ-панель** с полным управлением: пользователи, курсы, wiki, сертификаты, бэкапы, аналитика, пакетные операции.

### Качество и автоматизация
- **78 интеграционных тестов** (Vitest + Supertest) для API — auth и posts.
- **GitHub Actions CI** — линт, тесты и сборка на каждый push и PR. Зелёный CI блокирует мерж красного PR.
- **Ручной деплой в одну команду** — `bash scripts/deploy.sh` (бэкап БД → git pull → зависимости → миграция схемы → перезапуск → сборка клиента → healthcheck).
- **ESLint + Prettier** — единый стиль кода.

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

### Backend — качество и тесты
| Технология | Назначение |
|---|---|
| **Vitest 5** | Тест-раннер (ESM, быстрый) |
| **Supertest** | HTTP-тесты против Express-приложения |
| **ESLint 9** | Линтер (flat config, warnings не валят CI) |
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
| **GitHub Actions** | CI (тесты, линт, сборка) |
| **systemd** | Процесс-менеджер на сервере (`mediaraf-api.service`) |
| **Nginx** | Реверс-прокси, SSL, раздача SPA |

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
- **Prisma — единая точка работы с БД.** Схема синхронизируется через `prisma db push`.
- **Socket.IO** используется для чатов, typing-индикатора, уведомлений в реальном времени.
- **PWA** работает офлайн: precache HTML/JS/CSS, кеш `/uploads`, офлайн-экран при отсутствии сети.
- **systemd, а не pm2.** API запускается как системный сервис `mediaraf-api.service`, что даёт автозапуск после ребута, рестарт при падении и единый способ управления из CI/скриптов.

---

## 🚀 Быстрый старт

### Требования

- **Node.js** ≥ 22
- **PostgreSQL** ≥ 14 (на проде — 18)
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

```bash
# Создать базу (пример для Ubuntu)
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

### Переменные окружения

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
```

Создайте `server/.env.test` для интеграционных тестов (в git лежит `server/.env.test.example`):

```env
DATABASE_URL="postgresql://media_raf_raw:пароль@localhost:5432/media_raf_raw_test?schema=public"
JWT_SECRET="test-secret-do-not-use-in-prod"
NODE_ENV="test"
```

> ⚠️ **Важно:** тесты пишут данные в БД. Никогда не запускайте их против продакшн-базы. Всегда используйте отдельную тестовую базу (`media_raf_raw_test`).

> 🔒 `.env` и `.env.test` **не в git**. Если случайно закоммитили — немедленно отзовите секреты и удалите файл из истории.

Создайте `client/.env`:

```env
VITE_API="http://localhost:4000/api"
VITE_SOCKET="http://localhost:4000"
```

### Миграция и запуск

```bash
# 1. Применить схему Prisma (к основной и тестовой БД)
cd server
npx prisma db push
npx prisma generate

# Тестовая БД
DATABASE_URL="postgresql://media_raf_raw:пароль@localhost:5432/media_raf_raw_test" npx prisma db push --skip-generate

# 2. Запустить сервер (dev)
npm start

# 3. В отдельном терминале — клиент
cd ../client
npm run dev
```

Открыть **http://localhost:5173**

---

## 📁 Структура проекта

```
media-raf-raw1/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                             # CI: lint + tests + build на push/PR
│       └── deploy.yml                         # CD: деплой по SSH (см. «Известные ограничения»)
│
├── scripts/                                   # Общие скрипты
│   └── deploy.sh                              # Ручной деплой в одну команду
│
├── client/                                    # ─── React + Vite (SPA + PWA)
│   │
│   ├── public/                                # Статика, попадает в dist как есть
│   │   ├── favicon.svg
│   │   ├── favicon-16.png
│   │   ├── favicon-32.png
│   │   ├── apple-touch-icon.png               # 180×180 для iOS
│   │   ├── icon-192.png                       # PWA-иконка
│   │   ├── icon-512.png                       # PWA-иконка (high-res)
│   │   ├── icon-maskable.svg                  # Maskable-иконка для Android
│   │   └── robots.txt
│   │
│   ├── src/
│   │   │
│   │   ├── api/
│   │   │   └── client.js                      # fetch-обёртка, ApiError, uploadFile/uploadBlob, ping
│   │   │
│   │   ├── components/                        # Переиспользуемые компоненты
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
│   │   │       └── tabs/
│   │   │           ├── Dashboard.jsx
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
│   │   │           │
│   │   │           ├── Courses/
│   │   │           │   ├── index.jsx
│   │   │           │   ├── CourseEditor.jsx
│   │   │           │   ├── LessonEditor.jsx
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
│   │   │   └── gamification.jsx
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
│   │   │   ├── gamification.js                # Ядро: awardXp, deductXp, quests, streaks, hooks
│   │   │   ├── gamificationCatalog.js
│   │   │   ├── gamificationSettings.js
│   │   │   ├── gamificationCron.js
│   │   │   ├── courseLogic.js
│   │   │   └── audioPeaks.js
│   │   │
│   │   ├── middleware/
│   │   │   └── auth.js                        # JWT + requireRole + инвалидация по passwordChangedAt
│   │   │
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── users.js
│   │       ├── posts.js
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
│   │       └── admin.js
│   │
│   ├── scripts/                               # Скрипты миграции/обслуживания
│   │   └── migrate-to-pg.mjs                  # SQLite → PostgreSQL (архивный)
│   │
│   ├── tests/                                 # ─── Интеграционные тесты (Vitest + Supertest)
│   │   ├── setup.js                           # beforeAll/afterEach/afterAll: чистка БД
│   │   ├── helpers.js                         # createUser, createPost, makeAdmin, createComment
│   │   ├── smoke.test.js                      # Проверка, что модули экспортируют функции
│   │   ├── auth.register.test.js              # POST /api/auth/register
│   │   ├── auth.login.test.js                 # POST /api/auth/login
│   │   ├── auth.me.test.js                    # GET /api/auth/me
│   │   ├── auth.check.test.js                 # GET /api/auth/check-username|phone
│   │   ├── posts.feed.test.js                 # GET /api/posts/feed
│   │   ├── posts.crud.test.js                 # POST/PATCH/DELETE /api/posts
│   │   ├── posts.reactions.test.js            # Реакции на посты
│   │   └── posts.comments.test.js             # Комментарии и ответы
│   │
│   ├── eslint.config.js                       # ESLint (flat config, warnings не валят CI)
│   ├── vitest.config.js                       # Vitest (forks, без параллелизма)
│   ├── uploads/                               # Загруженные файлы (создаётся автоматически)
│   ├── backups/                               # Дампы PostgreSQL (создаётся автоматически)
│   ├── .env                                   # Не в git
│   ├── .env.test                              # Не в git
│   ├── .env.example                           # Шаблон
│   ├── .env.test.example                      # Шаблон тестового окружения
│   └── package.json
│
├── .gitignore                                 # node_modules, .env, .env.test, uploads/, backups/, dist/,
│                                              # собранный клиент в корне (index.html, assets/, sw.js, ...)
└── README.md
```

### Ключевые принципы организации

**Клиент:**
- **store/** — глобальный стейт через React Context. Каждый провайдер отвечает за свою часть.
- **pages/Admin/** — модульная админка. Один раздел = один файл в `tabs/`, всё сложное — в подпапках.
- **components/messenger/** — вынесено отдельно, т.к. мессенджер — самая тяжёлая часть UI.
- **hooks/** — переиспользуемая логика.
- **lib/** — утилиты без React.

**Сервер:**
- **`app.js`** — «чистое» Express-приложение. Экспортирует `app`, не вызывает `listen`. Это позволяет тестам импортировать его напрямую.
- **`index.js`** — только запуск: HTTP-сервер, Socket.IO, cron. Никакого Express-кода.
- **lib/** — вся бизнес-логика. Роуты тонкие, они только валидируют и вызывают функции из lib.
- **routes/** — HTTP-слой.
- **prisma/seed/** — данные курсов отделены от кода.
- **tests/** — интеграционные тесты, ходят через Supertest прямо в `app` без запуска сервера.

### Особенности

- **Нет `prisma migrate`** — только `db push`. История миграций не ведётся.
- **`uploads/` и `backups/`** — не в git, создаются на сервере.
- **`.env` и `.env.test`** — обязательны, шаблоны в `.env.example` и `.env.test.example`.
- **Собранный клиент публикуется в корень репо** — nginx отдаёт статику именно из `/www/wwwroot/mediarafraw.ru`, а не из `client/dist`. Эти файлы (index.html, assets/, sw.js, иконки) перечислены в `.gitignore` и не коммитятся.
- **PWA-манифест** — генерируется `vite-plugin-pwa` из `vite.config.js`, в `public/` лежат только иконки.

---

## 🗄 Работа с базой данных

Проект использует **PostgreSQL** и **Prisma ORM**.

### Основные команды

```bash
cd server

# Синхронизировать схему с БД (без миграций, безопасно)
npx prisma db push

# Пересобрать Prisma Client (обязательно после изменения схемы)
npx prisma generate

# Открыть Prisma Studio
npx prisma studio

# Проверить схему без изменений
npx prisma validate
```

### Важно

- Проект **не использует `prisma migrate`** — все изменения схемы применяются через `db push`.
- После изменения `schema.prisma` **обязательно** запустить `npx prisma generate` и **полностью перезапустить** Node-процесс:
  ```bash
  systemctl restart mediaraf-api
  ```
- `systemctl reload` или перезапуск через панель может **не подхватить** новые модели — только полный `restart`.

### Модели БД (обзор)

| Группа | Модели |
|---|---|
| Пользователи | `User`, `PushSubscription` |
| Соцсеть | `Post`, `Comment`, `PostReaction` |
| Мессенджер | `Chat`, `ChatMember`, `Message`, `Reaction` |
| Курсы | `Course`, `Lesson`, `Test`, `Question`, `TestAttempt`, `Enrollment`, `LessonProgress`, `Certificate` |
| Практики и ДЗ | `PracticalWork`, `PracticalSubmission`, `Homework`, `HomeworkSubmission` |
| Wiki | `WikiCategory`, `WikiArticle` |
| Система | `Notification`, `Setting`, `AdminAction` |
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

### Что тестируется

| Файл | Покрытие |
|---|---|
| `tests/smoke.test.js` | Проверка, что ключевые модули экспортируют функции |
| `tests/auth.register.test.js` | Регистрация: успех, валидация, уникальность, нормализация телефона/username |
| `tests/auth.login.test.js` | Вход: по username / телефону / email, регистронезависимость, бан |
| `tests/auth.me.test.js` | Текущий пользователь: токен, бан, обновление `lastSeen` |
| `tests/auth.check.test.js` | Проверка занятости username/телефона |
| `tests/posts.feed.test.js` | Лента: пагинация (cursor-based, без потерь), порядок, фильтрация забаненных, реакции |
| `tests/posts.crud.test.js` | Создание/редактирование/удаление постов + права доступа |
| `tests/posts.reactions.test.js` | Реакции: toggle, разные эмодзи, агрегация |
| `tests/posts.comments.test.js` | Комментарии: вложенность, редактирование, удаление, права |

### Подготовка тестовой БД

```bash
# Создать тестовую базу (один раз)
sudo -u postgres psql -c "CREATE DATABASE media_raf_raw_test;"

# Применить схему
cd server
DATABASE_URL="postgresql://media_raf_raw:пароль@localhost:5432/media_raf_raw_test" npx prisma db push --skip-generate
```

### Запуск

```bash
cd server

# Все тесты (использует .env.test через NODE_ENV=test)
NODE_ENV=test DATABASE_URL="postgresql://media_raf_raw:пароль@localhost:5432/media_raf_raw_test" JWT_SECRET="test-secret" npm test

# Один файл
npm test -- tests/posts.feed.test.js

# Watch-режим (для разработки)
npm run test:watch

# С покрытием
npm run test:cov
```

**Ожидаемый результат:** ~78 passed за ~35 секунд.

### Как устроены тесты

- **`tests/setup.js`** — глобальный `beforeAll`/`afterEach`/`afterAll`. После каждого теста удаляет всех тестовых юзеров (по префиксу `+7999` и `test_`) и связанные данные. Даёт 250 мс «хвоста» для завершения fire-and-forget задач (геймификация, уведомления), чтобы не ловить `P2025`.
- **`tests/helpers.js`** — утилиты: `createUser`, `createPost`, `createComment`, `makeAdmin`, `validPayload`. Генерируют уникальные телефоны и username, чтобы тесты не конфликтовали.
- **Изоляция от прод-данных.** Тесты постов фильтруют ленту по автору (`onlyTestPosts`), чтобы не полагаться на пустую БД. Это позволяет безопасно запускать их даже на тестовой БД, где случайно оказались «настоящие» данные.
- **Пойманные баги.** Тест `posts.feed.test.js` при первом запуске поймал реальный баг в cursor-пагинации ленты: последний элемент страницы «съедался» и терялся на следующей странице. Исправлено.

### Что делать, если тесты упали

1. Проверь `DATABASE_URL` — точно указывает на тестовую БД?
2. Убедись, что тестовая БД пуста (в тестах ленты мы фильтруем только свои посты, но мусор в БД может замедлить прогон).
3. Смотри в лог — Vitest показывает конкретный assert и стек.

---

## 🔄 CI/CD

### CI — `.github/workflows/ci.yml`

Запускается на каждый `push` в `main`/`dev` и на каждый Pull Request.

**Job `server`:**
1. Поднимает сервис-контейнер `postgres:16`.
2. Node 22.
3. `npm ci` в `server/`.
4. `npm run lint` — ESLint (warnings не валят job).
5. `npx prisma generate`.
6. `npx prisma db push --skip-generate` — схема в тестовую БД.
7. `npm test` — все 78 тестов.

**Job `client`:**
1. Node 22.
2. `npm ci` в `client/`.
3. `npm run build` — проверка, что фронт собирается.

**Если CI красный — PR блокируется.** Нельзя мержить код, который ломает тесты или сборку.

### CD — `.github/workflows/deploy.yml`

Workflow настроен, но **на текущем сервере не работает** из-за NAT (см. [Известные ограничения](#-известные-ограничения)). Используйте **ручной деплой через `scripts/deploy.sh`** (см. [Деплой](#-деплой)).

Что делает workflow (на случай переезда на сервер с публичным SSH):
1. Подключается по SSH к серверу (`secrets.SSH_HOST`, `SSH_USER`, `SSH_KEY`).
2. Бэкап БД.
3. `git pull origin main`.
4. В `server/`: `npm ci`, `npx prisma generate`, `npx prisma db push --skip-generate`, `systemctl restart mediaraf-api`.
5. В `client/`: `npm ci`, `npm run build`, копирование в корень.
6. Healthcheck.

### Локальная проверка перед push

```bash
# Server
cd server
npm run lint       # 0 errors (warnings OK)
NODE_ENV=test DATABASE_URL="..." JWT_SECRET="test-secret" npm test   # 78 passed

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

Все защищённые запросы требуют заголовок:
```
Authorization: Bearer <JWT>
```

### Основные роуты

| Роут | Описание |
|---|---|
| `GET /health` | Health-check (`{ok, service}`) |
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
| `GET /admin/*` | Все админские роуты (role=ADMIN) |

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
| Deadline reminders | `0 9 * * *` | Напоминания о дедлайнах практик/ДЗ |
| Drip unlock notifications | `0 8 * * *` | Уведомления о разблокировке уроков |

Расписание переопределяется через переменные окружения.

---

## 🚢 Деплой

### Ручной деплой — основной способ

На сервере:

```bash
cd /www/wwwroot/mediarafraw.ru
bash scripts/deploy.sh
```

**Что делает скрипт:**

1. **Проверка состояния репо.** Если есть незакоммиченные трекаемые файлы — стоп (untracked не считаются: там собранный клиент и служебные файлы).
2. **Бэкап БД.** Автоматически ищет `pg_dump` подходящей версии (`/www/server/pgsql/bin/pg_dump`, `/usr/lib/postgresql/18/...`, и т.д.). Сохраняет в `/root/db-backups/mediaraf_YYYYMMDD_HHMMSS.sql`.
3. **`git pull origin main`.**
4. **Server:** `npm ci`, `npx prisma generate`, `npx prisma db push --skip-generate`.
5. **Restart API:** `systemctl restart mediaraf-api`, проверка `is-active` + `curl /api/health`.
6. **Client:** `npm ci`, `npm run build`.
7. **Публикация клиента.** `cp -r client/dist/. .` — nginx отдаёт статику из корня репо.
8. **Финальные проверки:** API, `localhost/`, внешний домен.

Лог пишется в `/var/log/mediaraf-deploy.log`.

### Автоматический деплой (не работает на текущем сервере)

Workflow `.github/workflows/deploy.yml` настроен, но **SSH-подключение из GitHub Actions к серверу невозможно** — сервер находится за NAT хостера (LXC-контейнер с приватным IP `192.168.10.33`, внешний SSH на :22 ведёт не на наш sshd). См. [Известные ограничения](#-известные-ограничения).

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
npx prisma db push

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
# Создать логи и включить сервис
touch /var/log/mediaraf-api.log /var/log/mediaraf-api.err.log
chown www:www /var/log/mediaraf-api.log /var/log/mediaraf-api.err.log
systemctl daemon-reload
systemctl enable mediaraf-api
systemctl start mediaraf-api
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
scripts/deploy.sh              # Ручной деплой на прод (см. «Деплой»)
```

### Server (`server/package.json`)

```json
{
  "scripts": {
    "start": "node src/index.js",
    "seed": "node prisma/seed/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write \"src/**/*.js\""
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
- **Харденинг геймификации** — все операции `awardXp`/`deductXp` устойчивы к удалению пользователя во время выполнения (`P2025`/`P2003` не падают, а тихо возвращают `null`).
- **`.env` и `.env.test` — не в git.** Если случайно закоммитили — немедленно:
    1. Удалите файл: `git rm --cached server/.env.test`.
    2. Добавьте в `.gitignore`.
    3. **Ротируйте все секреты**, которые в нём были (`JWT_SECRET`, `VAPID_*`, пароль БД). Просто удалить файл недостаточно — он остаётся в истории git.
    4. После ротации `JWT_SECRET` все активные сессии станут невалидными — пользователи перелогинятся.

---

## 🐛 Известные ограничения

- **SQLite не поддерживается** — только PostgreSQL. Для dev на Mac используйте `brew services start postgresql`.
- **ffmpeg** обязателен для генерации waveform голосовых. Без него используется fallback.
- **`prisma migrate` не используется** — только `db push`. История миграций в проекте не ведётся.
- **PDF-экспорт сертификатов** работает на клиенте через `html-to-image` + `jsPDF`.
- **Тестовая БД — обязательна.** Тесты не изолированы от прод-данных, если запускать их против основной БД.
- **Автодеплой через GitHub Actions невозможен на текущем сервере.** Сервер — LXC-контейнер за NAT хостера (внутренний IP `192.168.10.33`, внешний `178.252.214.17` — это хост-машина, на её порту 22 отвечает чужой sshd). GitHub Actions не может подключиться к нашему sshd по SSH. **Решение:** ручной деплой через `bash scripts/deploy.sh`. Если переедете на VPS с публичным SSH — workflow `deploy.yml` заработает без изменений.
- **`pg_dump` и PostgreSQL должны совпадать по мажорной версии.** На проде PostgreSQL 18, а системный `pg_dump` в Ubuntu 24.04 — 16. `scripts/deploy.sh` автоматически ищет `pg_dump` от 18-й версии (aaPanel-овский `/www/server/pgsql/bin/pg_dump`).
- **npm-зеркала.** aaPanel ставит глобально `registry.npmmirror.com`, где периодически нет свежих пакетов. `scripts/deploy.sh` принудительно переключает registry на `https://registry.npmjs.org/`.

---

## 📄 Лицензия

Проект разработан для внутреннего использования студенческим медиацентром **MEDIA·RAF·RAW** (Radio Политех-FM). Не предназначен для публичного распространения без согласования с автором.

---

## 🙏 Благодарности

- Команда медиацентра MEDIA·RAF·RAW за тестирование и фидбэк.
- Сообщество разработчиков за открытые библиотеки, на которых построен проект.

---

**Made with ❤️ by MEDIA·RAF·RAW team**